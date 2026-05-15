export type CustomFieldDef = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select';
  options?: string[];
};

export type TaskRow = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  position: number;
  boardId?: string;
  description?: string | null;
  assigneeType?: string | null;
  assigneeId?: string | null;
  slaDeadline?: string | null;
  slaState?: Record<string, unknown>;
  tags?: string[];
  estimate?: number | null;
  estimateMode?: string;
  estimateUnitLabel?: string;
  resolution?: string | null;
  dueDate?: string | null;
  startDate?: string | null;
  metadata?: Record<string, unknown>;
  dependencies?: string[];
  parentTaskId?: string | null;
  createdAt: string;
};

export type ActivityRow = {
  id: string;
  action: string;
  actorType: string;
  before: unknown;
  after: unknown;
  createdAt: string;
};

export type EmployeeOption = {
  id: string;
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};
