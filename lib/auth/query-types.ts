export type QueryFeature = 'chart' | 'interpret' | 'heming';
export type QueryStatus = 'success' | 'failed';

export interface QueryBirthDetails {
  date: string;
  time: string;
  gender: '男' | '女';
  location?: string;
  method: string;
}

export interface QueryDetails {
  births: QueryBirthDetails[];
  result?: string;
}

export interface QueryRecord {
  id: string;
  email: string;
  feature: QueryFeature;
  status: QueryStatus;
  createdAt: string;
  hasDetails: boolean;
}

export const queryFeatureLabels: Record<QueryFeature, string> = {
  chart: '排盘',
  interpret: '单盘解读',
  heming: '双人合盘',
};

export const queryStatusLabels: Record<QueryStatus, string> = { success: '已完成', failed: '失败或中断' };
