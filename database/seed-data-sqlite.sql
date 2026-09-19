-- 27 پروژه
-- داده‌ی اولیه (تولید خودکار از src/data/framework.ts)

INSERT INTO Industry_Master (Code, TitleFa, TitleEn, Icon, Color, IsActive) VALUES ('c1', 'نفت و گاز', 'Oil & Gas', '🛢', '#7FB2FF', 1);
INSERT INTO Industry_Master (Code, TitleFa, TitleEn, Icon, Color, IsActive) VALUES ('c2', 'پتروشیمی', 'Petrochemical', '⚗️', '#8FE3C8', 1);
INSERT INTO Industry_Master (Code, TitleFa, TitleEn, Icon, Color, IsActive) VALUES ('c3', 'نیرو و انرژی', 'Power & Energy', '⚡', '#FFD48A', 1);
INSERT INTO Industry_Master (Code, TitleFa, TitleEn, Icon, Color, IsActive) VALUES ('c4', 'حفاری و اکتشاف', 'Drilling & Exploration', '🪨', '#FF9F9F', 1);
INSERT INTO Industry_Master (Code, TitleFa, TitleEn, Icon, Color, IsActive) VALUES ('c5', 'زیرساخت و ساختمان', 'Infrastructure & Construction', '🏗', '#C9A7FF', 1);
-- 5 صنعت

INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('OG-2401', 'توسعه میدان نفتی آزادگان جنوبی', 'South Azadegan Oilfield Development', 'شرکت ملی نفت', 'NIOC', 'active', 62, '$4.2B', 'خوزستان', 'Khuzestan', 'OG', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('OG-2402', 'طرح جمع‌آوری گازهای همراه', 'Associated Gas Gathering Plan', 'شرکت نفت مناطق مرکزی', 'ICOFC', 'active', 41, '$1.1B', 'اصفهان', 'Isfahan', 'OG', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('OG-2403', 'خط انتقال نفت خام گوره–جاسک', 'Goreh–Jask Crude Pipeline', 'شرکت خطوط لوله', 'IOPTC', 'completed', 100, '$2.0B', 'هرمزگان', 'Hormozgan', 'OG', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('OG-2404', 'مطالعه فاز ۱۴ پارس جنوبی توسعه‌ای', 'Phase 14 South Pars Study', 'پارس جنوبی', 'POGC', 'tender', 8, '$780M', 'بوشهر', 'Bushehr', 'OG', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('OG-2405', 'بازسازی سکوی SPD-19', 'SPD-19 Platform Refit', 'شرکت نفت فلات قاره', 'IOOC', 'stopped', 27, '$310M', 'خلیج فارس', 'Persian Gulf', 'OG', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('OG-2406', 'ایستگاه تقویت فشار گاز شانول', 'Shanul Gas Compressor Station', 'شرکت گاز', 'NIGC', 'active', 74, '$260M', 'فارس', 'Fars', 'OG', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('PC-2401', 'پتروشیمی الفین بندر امام (بازآرایی)', 'Bandar Imam Olefin Revamp', 'پتروشیمی بندر امام', 'BIPC', 'active', 58, '$690M', 'خوزستان', 'Khuzestan', 'PC', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('PC-2402', 'واحد متانول کاوه ۲', 'Kaveh Methanol #2 Unit', 'کاوه متانول', 'Kaveh Methanol', 'active', 33, '$1.3B', 'بندر دیر', 'Bandar Dayyer', 'PC', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('PC-2403', 'مطالعه امکان‌سنجی PTA خاورمیانه', 'Middle-East PTA Feasibility', 'هلدینگ خلیج فارس', 'PGPIC', 'tender', 12, '$540M', 'عسلویه', 'Asaluyeh', 'PC', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('PC-2404', 'پروپیلن جم — فاز نهایی', 'Jam Propylene — Final Phase', 'پتروشیمی جم', 'JPC', 'completed', 100, '$820M', 'بوشهر', 'Bushehr', 'PC', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('PC-2405', 'واحد پلی‌اتیلن ایلام', 'Ilam Polyethylene Unit', 'پتروشیمی ایلام', 'IPC', 'stopped', 44, '$470M', 'ایلام', 'Ilam', 'PC', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('PE-2401', 'نیروگاه سیکل ترکیبی دالاهو', 'Dalaho CCGT Power Plant', 'توانیر', 'TAVANIR', 'active', 51, '$920M', 'کرمانشاه', 'Kermanshah', 'PE', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('PE-2402', 'مزرعه بادی ۱۰۰ مگاواتی منجیل', 'Manjil 100MW Wind Farm', 'ساتبا', 'SATBA', 'active', 68, '$140M', 'گیلان', 'Gilan', 'PE', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('PE-2403', 'نیروگاه خورشیدی رفسنجان', 'Rafsanjan Solar Plant', 'بخش خصوصی', 'Private IPP', 'tender', 5, '$95M', 'کرمان', 'Kerman', 'PE', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('PE-2404', 'توسعه پست ۴۰۰ کیلوولت اهواز', 'Ahvaz 400kV Substation Expansion', 'برق منطقه‌ای خوزستان', 'KHZ REC', 'completed', 100, '$60M', 'اهواز', 'Ahvaz', 'PE', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('PE-2405', 'خط انتقال ۲۳۰ کیلوولت زاهدان', 'Zahedan 230kV Transmission Line', 'برق منطقه‌ای سیستان', 'SBC REC', 'stopped', 22, '$48M', 'سیستان و بلوچستان', 'Sistan', 'PE', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('DR-2401', 'حفاری چاه‌های توسعه‌ای پارس شمالی', 'North Pars Development Drilling', 'شرکت ملی حفاری', 'NIDC', 'active', 77, '$610M', 'خلیج فارس', 'Persian Gulf', 'DR', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('DR-2402', 'پروژه تعمیر و تکمیل چاه SP-9', 'SP-9 Well Workover', 'NIOC', 'NIOC', 'active', 44, '$110M', 'بوشهر', 'Bushehr', 'DR', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('DR-2403', 'مطالعات اکتشافی بلوک ۲۹ زاگرس', 'Zagros Block 29 Exploration Study', 'دایرکتوریت اکتشاف', 'Exploration Dir.', 'tender', 15, '$70M', 'لرستان', 'Lorestan', 'DR', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('DR-2404', 'پایان‌بندی چاه‌های اهواز-۴', 'Ahvaz-4 Well Completion', 'NISOC', 'NISOC', 'completed', 100, '$95M', 'خوزستان', 'Khuzestan', 'DR', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('DR-2405', 'سایت اکتشافی جنوب کرمان', 'South Kerman Exploration Site', 'شرکت ملی نفت', 'NIOC', 'stopped', 18, '$52M', 'کرمان', 'Kerman', 'DR', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('IC-2401', 'آزادراه تهران–شمال، قطعه ۲', 'Tehran-North Freeway, Sec. 2', 'وزارت راه', 'MRUD', 'active', 63, '$1.6B', 'مازندران', 'Mazandaran', 'IC', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('IC-2402', 'مترو خط ۷ توسعه غرب', 'Metro Line 7 West Extension', 'شهرداری تهران', 'Tehran Muni.', 'active', 39, '$980M', 'تهران', 'Tehran', 'IC', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('IC-2403', 'برج اداری مرکزی شهر مشهد', 'Mashhad Central Office Tower', 'توسعه‌گران خصوصی', 'Private Dev.', 'tender', 6, '$210M', 'خراسان رضوی', 'Razavi Khorasan', 'IC', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('IC-2404', 'سد و نیروگاه تنگاب فیروزآباد', 'Tangab Dam & Hydro Plant', 'وزارت نیرو', 'MoE', 'completed', 100, '$310M', 'فارس', 'فارس', 'IC', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('IC-2405', 'بازآفرینی بافت فرسوده اهواز', 'Ahvaz Urban Regeneration', 'شرکت بازآفرینی', 'UDRC', 'stopped', 21, '$140M', 'خوزستان', 'Khuzestan', 'IC', 1);
INSERT INTO Project_Master (ProjectCode, NameFa, NameEn, ClientFa, ClientEn, Status, Progress, Budget, LocationFa, LocationEn, IndustryCode, IsActive) VALUES ('IC-2406', 'پل کابلی خلیج فارس', 'Persian Gulf Cable-Stayed Bridge', 'وزارت راه', 'MRUD', 'active', 55, '$720M', 'هرمزگان', 'Hormozgan', 'IC', 1);

-- مختصاتِ سایت از گَزِتیرِ ماژول GIS
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('OG-2401', 31.32, 48.67, 'province', 'خوزستان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('OG-2402', 32.65, 51.67, 'city', 'اصفهان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('OG-2403', 27.18, 56.28, 'province', 'هرمزگان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('OG-2404', 28.92, 50.84, 'city', 'بوشهر');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('OG-2405', 27.5, 52, 'region', 'خلیج فارس');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('OG-2406', 29.59, 52.58, 'province', 'فارس');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('PC-2401', 31.32, 48.67, 'province', 'خوزستان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('PC-2402', 27.83, 51.94, 'city', 'بندر دیر');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('PC-2403', 27.48, 52.61, 'city', 'عسلویه');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('PC-2404', 28.92, 50.84, 'city', 'بوشهر');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('PC-2405', 33.63, 46.42, 'city', 'ایلام');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('PE-2401', 34.31, 47.07, 'city', 'کرمانشاه');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('PE-2402', 37.28, 49.58, 'province', 'گیلان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('PE-2403', 30.28, 57.08, 'city', 'کرمان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('PE-2404', 31.32, 48.67, 'city', 'اهواز');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('PE-2405', 29.49, 60.86, 'province', 'سیستان و بلوچستان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('DR-2401', 27.5, 52, 'region', 'خلیج فارس');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('DR-2402', 28.92, 50.84, 'city', 'بوشهر');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('DR-2403', 33.49, 48.36, 'province', 'لرستان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('DR-2404', 31.32, 48.67, 'province', 'خوزستان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('DR-2405', 30.28, 57.08, 'city', 'کرمان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('IC-2401', 36.56, 53.06, 'province', 'مازندران');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('IC-2402', 35.69, 51.39, 'city', 'تهران');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('IC-2403', 36.3, 59.61, 'province', 'خراسان رضوی');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('IC-2404', 29.59, 52.58, 'province', 'فارس');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('IC-2405', 31.32, 48.67, 'province', 'خوزستان');
INSERT INTO Project_Site (ProjectCode, Latitude, Longitude, Accuracy, LocationFa) VALUES ('IC-2406', 27.18, 56.28, 'province', 'هرمزگان');
-- 27 سایت