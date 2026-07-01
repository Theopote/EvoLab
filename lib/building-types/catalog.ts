import type { TypologyPackId } from "@/lib/typology/types";

export type BuildingTypeCategoryId =
  | "office"
  | "residential"
  | "healthcare"
  | "education"
  | "commercial"
  | "industrial"
  | "hospitality"
  | "cultural"
  | "other";

export interface BuildingTypeCategory {
  id: BuildingTypeCategoryId;
  labelZh: string;
}

export interface BuildingTypeDefinition {
  id: string;
  labelZh: string;
  labelEn: string;
  category: BuildingTypeCategoryId;
  /** Rule pack / topology preset source */
  typologyPackId: TypologyPackId;
  description: string;
}

export const BUILDING_TYPE_CATEGORIES: BuildingTypeCategory[] = [
  { id: "office", labelZh: "办公" },
  { id: "residential", labelZh: "住宅" },
  { id: "healthcare", labelZh: "医疗" },
  { id: "education", labelZh: "教育" },
  { id: "commercial", labelZh: "商业" },
  { id: "industrial", labelZh: "工业" },
  { id: "hospitality", labelZh: "酒店餐饮" },
  { id: "cultural", labelZh: "文化体育" },
  { id: "other", labelZh: "其他" }
];

export const BUILDING_TYPES: BuildingTypeDefinition[] = [
  { id: "office", labelZh: "办公建筑", labelEn: "Office", category: "office", typologyPackId: "office", description: "写字楼、总部园区、联合办公" },
  { id: "coworking", labelZh: "联合办公", labelEn: "Coworking", category: "office", typologyPackId: "office", description: "共享办公、创客空间" },
  { id: "residential", labelZh: "住宅建筑", labelEn: "Residential", category: "residential", typologyPackId: "residential", description: "多层/高层住宅、公寓" },
  { id: "apartment", labelZh: "公寓住宅", labelEn: "Apartment", category: "residential", typologyPackId: "residential", description: "租赁公寓、人才公寓" },
  { id: "villa", labelZh: "别墅住宅", labelEn: "Villa", category: "residential", typologyPackId: "residential", description: "低层独栋、联排别墅" },
  { id: "dormitory", labelZh: "宿舍建筑", labelEn: "Dormitory", category: "residential", typologyPackId: "residential", description: "学生宿舍、职工宿舍" },
  { id: "healthcare", labelZh: "医疗建筑", labelEn: "Healthcare", category: "healthcare", typologyPackId: "healthcare", description: "综合医院、专科医院" },
  { id: "hospital", labelZh: "医院", labelEn: "Hospital", category: "healthcare", typologyPackId: "healthcare", description: "门诊、住院、医技科室" },
  { id: "clinic", labelZh: "诊所 / 卫生院", labelEn: "Clinic", category: "healthcare", typologyPackId: "healthcare", description: "社区医疗、专科诊所" },
  { id: "eldercare", labelZh: "养老建筑", labelEn: "Eldercare", category: "healthcare", typologyPackId: "healthcare", description: "养老院、护理中心" },
  { id: "school", labelZh: "学校建筑", labelEn: "School", category: "education", typologyPackId: "school", description: "中小学、职业学校" },
  { id: "university", labelZh: "大学校园", labelEn: "University", category: "education", typologyPackId: "school", description: "高校教学楼、实验楼" },
  { id: "kindergarten", labelZh: "幼儿园", labelEn: "Kindergarten", category: "education", typologyPackId: "school", description: "幼教、托育建筑" },
  { id: "retail", labelZh: "商店 / 零售", labelEn: "Retail", category: "commercial", typologyPackId: "office", description: "沿街商铺、专卖店" },
  { id: "mall", labelZh: "商场 / 购物中心", labelEn: "Mall", category: "commercial", typologyPackId: "office", description: "商业综合体、百货" },
  { id: "supermarket", labelZh: "超市", labelEn: "Supermarket", category: "commercial", typologyPackId: "office", description: "大型卖场、仓储超市" },
  { id: "factory", labelZh: "工厂", labelEn: "Factory", category: "industrial", typologyPackId: "office", description: "生产车间、轻工业厂房" },
  { id: "warehouse", labelZh: "仓库 / 物流", labelEn: "Warehouse", category: "industrial", typologyPackId: "office", description: "物流库、配送中心" },
  { id: "workshop", labelZh: "车间厂房", labelEn: "Workshop", category: "industrial", typologyPackId: "office", description: "加工车间、装配厂房" },
  { id: "hotel", labelZh: "酒店", labelEn: "Hotel", category: "hospitality", typologyPackId: "office", description: "星级酒店、商务酒店" },
  { id: "restaurant", labelZh: "餐饮建筑", labelEn: "Restaurant", category: "hospitality", typologyPackId: "office", description: "餐厅、食堂、宴会厅" },
  { id: "cultural", labelZh: "文化建筑", labelEn: "Cultural", category: "cultural", typologyPackId: "office", description: "图书馆、文化馆" },
  { id: "museum", labelZh: "博物馆", labelEn: "Museum", category: "cultural", typologyPackId: "office", description: "展览、陈列建筑" },
  { id: "sports", labelZh: "体育建筑", labelEn: "Sports", category: "cultural", typologyPackId: "office", description: "体育馆、游泳馆" },
  { id: "theater", labelZh: "剧院 / 演艺", labelEn: "Theater", category: "cultural", typologyPackId: "office", description: "剧场、演艺中心" },
  { id: "exhibition", labelZh: "展览建筑", labelEn: "Exhibition", category: "cultural", typologyPackId: "office", description: "会展中心、展厅" },
  { id: "mixed-use", labelZh: "混合用途", labelEn: "Mixed Use", category: "other", typologyPackId: "office", description: "商住办混合、TOD 综合体" },
  { id: "parking", labelZh: "停车库", labelEn: "Parking", category: "other", typologyPackId: "office", description: "地下车库、立体停车" },
  { id: "religious", labelZh: "宗教建筑", labelEn: "Religious", category: "other", typologyPackId: "office", description: "教堂、寺庙等" }
];

const BUILDING_TYPE_BY_ID = Object.fromEntries(BUILDING_TYPES.map((type) => [type.id, type])) as Record<
  string,
  BuildingTypeDefinition
>;

export function getBuildingType(buildingTypeId: string): BuildingTypeDefinition {
  return BUILDING_TYPE_BY_ID[buildingTypeId] ?? BUILDING_TYPE_BY_ID.office;
}

export function getBuildingTypeLabel(buildingTypeId: string): string {
  return getBuildingType(buildingTypeId).labelZh;
}

export function listBuildingTypesByCategory(categoryId: BuildingTypeCategoryId) {
  return BUILDING_TYPES.filter((type) => type.category === categoryId);
}

export function listBuildingTypeOptions() {
  return BUILDING_TYPES.map((type) => ({
    id: type.id,
    labelZh: type.labelZh,
    category: type.category
  }));
}
