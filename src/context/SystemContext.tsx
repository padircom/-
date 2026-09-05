import React, { createContext, useContext, useEffect, useState } from "react";
import {
  clusters as defaultClusters,
  projectsByCluster as defaultProjectsByCluster,
  type Cluster,
  type Project,
} from "../data/framework";
import { debounce } from "../utils/debounce";
import { pmisApiClient } from "../services/pmisApiClient";

export type SystemSettings = {
  fontScale: "normal" | "large" | "xlarge";
  fontFamily: "vazir" | "shabnam" | "sahel" | "system";
  sqlConnectionString: string;
  databaseName: string;
  aiProvider: "openai" | "deepseek" | "local" | "mock";
  aiModel: string;
  aiApiKey: string;
  autoSyncLive: boolean;
};

export type ProjectScope = {
  clusterId: string;
  projectId: string;
};

export type SyncResult = {
  direction: "pull" | "push" | "restore";
  industries: number;
  projects: number;
  warnings: string[];
  completedAt: string;
};

export type MasterDataBackup = {
  version: 1;
  exportedAt: string;
  clusters: Cluster[];
  projectsByCluster: Record<string, Project[]>;
  settings: Omit<SystemSettings, "aiApiKey">;
  projectScope: ProjectScope | null;
};

const defaultSettings: SystemSettings = {
  fontScale: "large",
  fontFamily: "vazir",
  sqlConnectionString: ".\\SQL2008EXPRESS",
  databaseName: "PMIS_MASTER_DB",
  aiProvider: "mock",
  aiModel: "gpt-4o-pm-expert",
  aiApiKey: "",
  autoSyncLive: true,
};

type SystemContextType = {
  clusters: Cluster[];
  projectsByCluster: Record<string, Project[]>;
  settings: SystemSettings;
  projectScope: ProjectScope | null;
  addCluster: (cluster: Cluster) => void;
  updateCluster: (id: string, updated: Partial<Cluster>) => void;
  deleteCluster: (id: string) => void;
  addProject: (clusterId: string, project: Project) => void;
  updateProject: (clusterId: string, projectId: string, updated: Partial<Project>) => void;
  deleteProject: (clusterId: string, projectId: string) => void;
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  setProjectScope: (scope: ProjectScope | null) => void;
  pullMasterData: () => Promise<SyncResult>;
  pushMasterData: () => Promise<SyncResult>;
  createBackup: () => MasterDataBackup;
  restoreBackup: (backup: MasterDataBackup) => SyncResult;
  resetToDefaults: () => void;
};

const SystemContext = createContext<SystemContextType | undefined>(undefined);

const STORAGE_KEY_CLUSTERS = "pmis:custom-clusters:v1";
const STORAGE_KEY_PROJECTS = "pmis:custom-projects:v1";
const STORAGE_KEY_SETTINGS = "pmis:custom-settings:v1";
const STORAGE_KEY_SCOPE = "pmis:active-project-scope:v1";

// Stable debounced writers avoid unnecessary localStorage work during rapid edits.
const persistClusters = debounce((data: Cluster[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_CLUSTERS, JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}, 500);

const persistProjects = debounce((data: Record<string, Project[]>) => {
  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}, 500);

const persistSettings = debounce((data: SystemSettings) => {
  try {
    // Provider/model choices are safe to persist; the API secret must stay server-side.
    const { aiApiKey: _aiApiKey, ...safeSettings } = data;
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(safeSettings));
  } catch (e) {
    console.error(e);
  }
}, 500);

const persistProjectScope = debounce((data: ProjectScope | null) => {
  try {
    if (data) localStorage.setItem(STORAGE_KEY_SCOPE, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY_SCOPE);
  } catch (e) {
    console.error(e);
  }
}, 250);

export const SystemProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clusters, setClusters] = useState<Cluster[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CLUSTERS);
      return saved ? JSON.parse(saved) : defaultClusters;
    } catch {
      return defaultClusters;
    }
  });

  const [projectsByCluster, setProjectsByCluster] = useState<Record<string, Project[]>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PROJECTS);
      return saved ? JSON.parse(saved) : defaultProjectsByCluster;
    } catch {
      return defaultProjectsByCluster;
    }
  });

  const [settings, setSettings] = useState<SystemSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
      return saved ? JSON.parse(saved) : defaultSettings;
    } catch {
      return defaultSettings;
    }
  });

  const [projectScope, setProjectScope] = useState<ProjectScope | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SCOPE);
      if (saved) return JSON.parse(saved) as ProjectScope;
      const firstCluster = defaultClusters[0];
      const firstProject = firstCluster ? defaultProjectsByCluster[firstCluster.id]?.[0] : undefined;
      return firstCluster && firstProject ? { clusterId: firstCluster.id, projectId: firstProject.id } : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    persistClusters(clusters);
  }, [clusters]);

  useEffect(() => {
    persistProjects(projectsByCluster);
  }, [projectsByCluster]);

  useEffect(() => {
    persistSettings(settings);
  }, [settings]);

  useEffect(() => {
    persistProjectScope(projectScope);
  }, [projectScope]);

  // Keep scope valid when a system administrator adds, edits, or deletes master data.
  useEffect(() => {
    if (projectScope && projectsByCluster[projectScope.clusterId]?.some((p) => p.id === projectScope.projectId)) return;
    const firstCluster = clusters.find((cluster) => (projectsByCluster[cluster.id] ?? []).length > 0);
    const firstProject = firstCluster ? projectsByCluster[firstCluster.id]?.[0] : undefined;
    setProjectScope(firstCluster && firstProject ? { clusterId: firstCluster.id, projectId: firstProject.id } : null);
  }, [clusters, projectsByCluster, projectScope]);

  // Apply font-scale dynamically to the document root
  useEffect(() => {
    const root = document.documentElement;
    if (settings.fontScale === "large") {
      root.style.fontSize = "16.5px";
    } else if (settings.fontScale === "xlarge") {
      root.style.fontSize = "17.5px";
    } else {
      root.style.fontSize = "15px";
    }
  }, [settings.fontScale]);

  const addCluster = (cluster: Cluster) => {
    setClusters((prev) => [...prev, cluster]);
    setProjectsByCluster((prev) => ({ ...prev, [cluster.id]: [] }));
  };

  const updateCluster = (id: string, updated: Partial<Cluster>) => {
    setClusters((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
    );
  };

  const deleteCluster = (id: string) => {
    setClusters((prev) => prev.filter((c) => c.id !== id));
    setProjectsByCluster((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const addProject = (clusterId: string, project: Project) => {
    setProjectsByCluster((prev) => {
      const currentList = prev[clusterId] ?? [];
      const updatedList = [project, ...currentList];
      return { ...prev, [clusterId]: updatedList };
    });
    // Update cluster counts automatically
    recalcClusterCounts(clusterId);
  };

  const updateProject = (clusterId: string, projectId: string, updated: Partial<Project>) => {
    setProjectsByCluster((prev) => {
      const currentList = prev[clusterId] ?? [];
      const updatedList = currentList.map((p) =>
        p.id === projectId ? { ...p, ...updated } : p
      );
      return { ...prev, [clusterId]: updatedList };
    });
    recalcClusterCounts(clusterId);
  };

  const deleteProject = (clusterId: string, projectId: string) => {
    setProjectsByCluster((prev) => {
      const currentList = prev[clusterId] ?? [];
      const updatedList = currentList.filter((p) => p.id !== projectId);
      return { ...prev, [clusterId]: updatedList };
    });
    recalcClusterCounts(clusterId);
  };

  const recalcClusterCounts = (clusterId: string) => {
    setTimeout(() => {
      setProjectsByCluster((latestProjects) => {
        const list = latestProjects[clusterId] ?? [];
        const active = list.filter((p) => p.status === "active").length;
        const tender = list.filter((p) => p.status === "tender").length;
        const stopped = list.filter((p) => p.status === "stopped").length;
        const completed = list.filter((p) => p.status === "completed").length;
        const avgProgress =
          list.length > 0
            ? Math.round(list.reduce((acc, p) => acc + (p.progress || 0), 0) / list.length)
            : 0;

        setClusters((prevClusters) =>
          prevClusters.map((c) =>
            c.id === clusterId
              ? {
                  ...c,
                  active,
                  tender,
                  stopped,
                  completed,
                  progress: avgProgress,
                }
              : c
          )
        );
        return latestProjects;
      });
    }, 50);
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  };

  const createBackup = (): MasterDataBackup => {
    const { aiApiKey: _aiApiKey, ...safeSettings } = settings;
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      clusters,
      projectsByCluster,
      settings: safeSettings,
      projectScope,
    };
  };

  const restoreBackup = (backup: MasterDataBackup): SyncResult => {
    if (backup.version !== 1 || !Array.isArray(backup.clusters) || !backup.projectsByCluster) {
      throw new Error("Unsupported or invalid PMIS backup file");
    }
    setClusters(backup.clusters);
    setProjectsByCluster(backup.projectsByCluster);
    setSettings((current) => ({ ...current, ...backup.settings, aiApiKey: current.aiApiKey }));
    setProjectScope(backup.projectScope);
    return {
      direction: "restore",
      industries: backup.clusters.length,
      projects: Object.values(backup.projectsByCluster).reduce((sum, rows) => sum + rows.length, 0),
      warnings: [],
      completedAt: new Date().toISOString(),
    };
  };

  const pullMasterData = async (): Promise<SyncResult> => {
    const remoteIndustries = await pmisApiClient.getIndustries({ pageSize: 500 });
    const warnings: string[] = [];
    const nextClusters: Cluster[] = [];
    const nextProjects: Record<string, Project[]> = {};

    for (const industry of remoteIndustries.items) {
      const remoteProjects = await pmisApiClient.getProjects(industry.code, { pageSize: 1000 });
      const projects = remoteProjects.items.map((project) => ({
        id: project.id,
        code: project.code,
        name: { fa: project.nameFa, en: project.nameEn || project.nameFa },
        client: { fa: project.clientFa || "-", en: project.clientFa || "-" },
        status: project.status,
        progress: Number(project.progress) || 0,
        budget: project.budget == null ? "$0" : `$${Number(project.budget).toLocaleString("en-US")}`,
        location: { fa: project.locationFa || "-", en: project.locationFa || "-" },
      }));
      nextProjects[industry.code] = projects;
      const counts = {
        active: projects.filter((p) => p.status === "active").length,
        tender: projects.filter((p) => p.status === "tender").length,
        stopped: projects.filter((p) => p.status === "stopped").length,
        completed: projects.filter((p) => p.status === "completed").length,
      };
      nextClusters.push({
        id: industry.code,
        icon: industry.icon || "🏭",
        color: industry.color || "#38BDF8",
        title: { fa: industry.titleFa, en: industry.titleEn || industry.titleFa },
        progress: projects.length ? Math.round(projects.reduce((sum, p) => sum + p.progress, 0) / projects.length) : 0,
        ...counts,
      });
    }

    if (!nextClusters.length) warnings.push("Backend returned no active industries");
    setClusters(nextClusters);
    setProjectsByCluster(nextProjects);
    const firstCluster = nextClusters.find((cluster) => nextProjects[cluster.id]?.length);
    const firstProject = firstCluster ? nextProjects[firstCluster.id]?.[0] : undefined;
    setProjectScope(firstCluster && firstProject ? { clusterId: firstCluster.id, projectId: firstProject.id } : null);
    return {
      direction: "pull",
      industries: nextClusters.length,
      projects: Object.values(nextProjects).reduce((sum, rows) => sum + rows.length, 0),
      warnings,
      completedAt: new Date().toISOString(),
    };
  };

  const pushMasterData = async (): Promise<SyncResult> => {
    const warnings: string[] = [];
    let pushedIndustries = 0;
    let pushedProjects = 0;
    const remoteIndustries = await pmisApiClient.getIndustries({ pageSize: 500 });
    const remoteIndustryCodes = new Set(remoteIndustries.items.map((row) => row.code));

    for (const cluster of clusters) {
      if (!remoteIndustryCodes.has(cluster.id)) {
        await pmisApiClient.createIndustry({
          code: cluster.id,
          titleFa: cluster.title.fa,
          titleEn: cluster.title.en,
          icon: cluster.icon,
          color: cluster.color,
          isActive: true,
        });
        pushedIndustries += 1;
      }
      const remoteProjects = await pmisApiClient.getProjects(cluster.id, { pageSize: 1000 });
      const remoteCodes = new Set(remoteProjects.items.map((row) => row.code));
      for (const project of projectsByCluster[cluster.id] ?? []) {
        if (remoteCodes.has(project.code)) continue;
        const parsedBudget = Number(project.budget.replace(/[^0-9.]/g, "")) || 0;
        await pmisApiClient.createProject({
          industryId: cluster.id,
          code: project.code,
          nameFa: project.name.fa,
          nameEn: project.name.en,
          clientFa: project.client.fa,
          locationFa: project.location.fa,
          budget: parsedBudget,
          currency: "USD",
          status: project.status,
          progress: project.progress,
        });
        pushedProjects += 1;
      }
    }
    if (!pushedIndustries && !pushedProjects) warnings.push("Remote master data already contains all local codes");
    return { direction: "push", industries: pushedIndustries, projects: pushedProjects, warnings, completedAt: new Date().toISOString() };
  };

  const resetToDefaults = () => {
    setClusters(defaultClusters);
    setProjectsByCluster(defaultProjectsByCluster);
    setSettings(defaultSettings);
    const firstCluster = defaultClusters[0];
    const firstProject = firstCluster ? defaultProjectsByCluster[firstCluster.id]?.[0] : undefined;
    setProjectScope(firstCluster && firstProject ? { clusterId: firstCluster.id, projectId: firstProject.id } : null);
    localStorage.removeItem(STORAGE_KEY_CLUSTERS);
    localStorage.removeItem(STORAGE_KEY_PROJECTS);
    localStorage.removeItem(STORAGE_KEY_SETTINGS);
    localStorage.removeItem(STORAGE_KEY_SCOPE);
  };

  return (
    <SystemContext.Provider
      value={{
        clusters,
        projectsByCluster,
        settings,
        projectScope,
        addCluster,
        updateCluster,
        deleteCluster,
        addProject,
        updateProject,
        deleteProject,
        updateSettings,
        setProjectScope,
        pullMasterData,
        pushMasterData,
        createBackup,
        restoreBackup,
        resetToDefaults,
      }}
    >
      {children}
    </SystemContext.Provider>
  );
};

export const useSystem = () => {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error("useSystem must be used within a SystemProvider");
  }
  return context;
};
