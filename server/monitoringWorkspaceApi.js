/** LIVE-5: authorized read-only aggregation. No calls to legacy demo endpoints, no writes. */
import { MONITOR_SOURCES, buildMonitoring } from './monitoringWsLogic.js';
export function registerMonitoringWorkspaceRoutes(app, { repo, subjects, evaluate }) {
  app.get('/api/monitoring/:projectId/workspace', async (req, res, next) => {
    const fail = (status, code, message) => res.status(status).json({ ok: false, error: { code, message, traceId: req.requestId } });
    const projectId = req.params.projectId;
    if (!/^[A-Za-z0-9_-]{1,50}$/.test(projectId)) return fail(400, 'MON_PROJECT', 'شناسهٔ پروژه نامعتبر است');
    const horizonDays = req.query.horizonDays === undefined ? 30 : Number(req.query.horizonDays);
    if (![30, 60, 90].includes(horizonDays)) return fail(400, 'MON_HORIZON', 'افق باید ۳۰، ۶۰ یا ۹۰ روز باشد');
    const subject = subjects.find(s => s.id === String(req.headers['x-user-id'] || '').trim() && s.active);
    if (!subject) return fail(401, 'MON_AUTH', 'هویت معتبر لازم است');
    const can = (permission, extra = {}) => evaluate(subject, permission, { projectId, ...extra }).allow;
    if (!can('pex.dashboard.view')) return fail(403, 'MON_FORBIDDEN', 'مجوز پایش یا دسترسی به پروژه را ندارید');
    try {
      const r = await repo();
      const generatedAt = new Date().toISOString();
      const permitted = (spec, extra = {}) => spec.all ? spec.permissions.every(p => can(p, extra)) : spec.permissions.some(p => can(p, extra));
      const sources = await Promise.all(MONITOR_SOURCES.map(async spec => {
        if (!permitted(spec)) return { table: spec.table, state: 'restricted', rows: [] };
        try {
          const where = [{ column: 'ProjectId', op: 'eq', value: projectId }];
          if (spec.discipline && subject.disciplines?.length && !subject.disciplines.includes('*')) where.push({ column: 'Discipline', op: 'in', value: subject.disciplines });
          const raw = await r.list(spec.table, { where, limit: 5001 });
          // Never present a truncated collection as a complete KPI. Pagination/large-data aggregation is separate work.
          if (raw.length > 5000) return { table: spec.table, state: 'too_large', rows: [] };
          const rows = raw.filter(row => {
            if (row.Classification && !['public', 'internal', 'confidential', 'restricted'].includes(row.Classification)) return false;
            return permitted(spec, row.Classification ? { classification: row.Classification } : {});
          });
          return { table: spec.table, state: rows.length ? 'ready' : 'empty', rows };
        } catch (err) {
          console.error(`[${req.requestId}] monitoring source unavailable: ${spec.table}`, err?.code ?? err?.name);
          return { table: spec.table, state: 'unavailable', rows: [] };
        }
      }));
      // Progress metadata must not expose activities outside the visible discipline/scope.
      const activities = sources.find(s => s.table === 'Activity');
      const progress = sources.find(s => s.table === 'ProgressEntry');
      if (progress && ['ready', 'empty'].includes(progress.state)) {
        if (!activities || !['ready', 'empty'].includes(activities.state)) { progress.state = activities?.state ?? 'unavailable'; progress.rows = []; }
        else {
          const ids = new Set(activities.rows.map(row => row.Id));
          progress.rows = progress.rows.filter(row => ids.has(row.ActivityId));
          progress.state = progress.rows.length ? 'ready' : 'empty';
        }
      }
      const data = buildMonitoring(sources, generatedAt.slice(0, 10), horizonDays);
      res.set('Cache-Control', 'no-store').json({ ok: true, data: { ...data, projectId, generatedAt, version: 'monitoring-v1' }, meta: { traceId: req.requestId } });
    } catch (err) { next(err); }
  });
}
