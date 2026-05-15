import { sequelize } from '../config/database';
import { User } from './User';
import { Tenant } from './Tenant';
import { TenantMembership } from './TenantMembership';
import { SubscriptionPlan } from './SubscriptionPlan';
import { TenantSubscription } from './TenantSubscription';
import { TenantUsage } from './TenantUsage';
import { RefreshToken } from './RefreshToken';
import { Project } from './Project';
import { Board } from './Board';
import { ProjectMember } from './ProjectMember';
import { EmployeeProfile } from './EmployeeProfile';
import { Agent } from './Agent';
import { Task } from './Task';
import { ActivityLog } from './ActivityLog';
import { Reassignment } from './Reassignment';
import { StripeEvent } from './StripeEvent';
import { TenantInvitation } from './TenantInvitation';
import { TaskComment } from './TaskComment';
import { UserNotification } from './UserNotification';
import { RecurringTaskRule } from './RecurringTaskRule';
import { ContactSalesLead } from './ContactSalesLead';
import { TaskRelation } from './TaskRelation';
import { ImportJob } from './ImportJob';
import { Document } from './Document';
import { Form } from './Form';

User.hasMany(TenantMembership, { foreignKey: 'userId' });
TenantMembership.belongsTo(User, { foreignKey: 'userId' });

Tenant.hasMany(TenantMembership, { foreignKey: 'tenantId' });
TenantMembership.belongsTo(Tenant, { foreignKey: 'tenantId' });

Tenant.hasOne(TenantSubscription, { foreignKey: 'tenantId' });
TenantSubscription.belongsTo(Tenant, { foreignKey: 'tenantId' });

SubscriptionPlan.hasMany(TenantSubscription, { foreignKey: 'planId' });
TenantSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'planId' });

Tenant.hasOne(TenantUsage, { foreignKey: 'tenantId' });
TenantUsage.belongsTo(Tenant, { foreignKey: 'tenantId' });

User.hasMany(RefreshToken, { foreignKey: 'userId' });
RefreshToken.belongsTo(User, { foreignKey: 'userId' });

Tenant.hasMany(Project, { foreignKey: 'tenantId' });
Project.belongsTo(Tenant, { foreignKey: 'tenantId' });

Tenant.hasMany(Board, { foreignKey: 'tenantId' });
Board.belongsTo(Tenant, { foreignKey: 'tenantId' });
Project.hasMany(Board, { foreignKey: 'projectId' });
Board.belongsTo(Project, { foreignKey: 'projectId' });

Tenant.hasMany(ProjectMember, { foreignKey: 'tenantId' });
ProjectMember.belongsTo(Tenant, { foreignKey: 'tenantId' });
Project.hasMany(ProjectMember, { foreignKey: 'projectId' });
ProjectMember.belongsTo(Project, { foreignKey: 'projectId' });
ProjectMember.belongsTo(User, { foreignKey: 'userId' });
User.hasMany(ProjectMember, { foreignKey: 'userId' });

Tenant.hasMany(EmployeeProfile, { foreignKey: 'tenantId' });
EmployeeProfile.belongsTo(Tenant, { foreignKey: 'tenantId' });
User.hasMany(EmployeeProfile, { foreignKey: 'userId' });
EmployeeProfile.belongsTo(User, { foreignKey: 'userId' });
EmployeeProfile.belongsTo(User, { foreignKey: 'managerId', as: 'Manager' });

Tenant.hasMany(Agent, { foreignKey: 'tenantId' });
Agent.belongsTo(Tenant, { foreignKey: 'tenantId' });

Tenant.hasMany(Task, { foreignKey: 'tenantId' });
Task.belongsTo(Tenant, { foreignKey: 'tenantId' });

Project.hasMany(Task, { foreignKey: 'projectId' });
Task.belongsTo(Project, { foreignKey: 'projectId' });
Board.hasMany(Task, { foreignKey: 'boardId' });
Task.belongsTo(Board, { foreignKey: 'boardId' });

// Task-to-task relations (many-to-many, symmetric via normalized pairs).
Task.hasMany(TaskRelation, { foreignKey: 'fromTaskId', as: 'OutgoingRelations' });
Task.hasMany(TaskRelation, { foreignKey: 'toTaskId', as: 'IncomingRelations' });
TaskRelation.belongsTo(Task, { foreignKey: 'fromTaskId', as: 'FromTask' });
TaskRelation.belongsTo(Task, { foreignKey: 'toTaskId', as: 'ToTask' });

Tenant.hasMany(TaskRelation, { foreignKey: 'tenantId' });
TaskRelation.belongsTo(Tenant, { foreignKey: 'tenantId' });
Project.hasMany(TaskRelation, { foreignKey: 'projectId' });
TaskRelation.belongsTo(Project, { foreignKey: 'projectId' });

User.hasMany(Task, { foreignKey: 'createdBy' });
Task.belongsTo(User, { foreignKey: 'createdBy' });

Tenant.hasMany(ActivityLog, { foreignKey: 'tenantId' });
ActivityLog.belongsTo(Tenant, { foreignKey: 'tenantId' });
Task.hasMany(ActivityLog, { foreignKey: 'taskId' });
ActivityLog.belongsTo(Task, { foreignKey: 'taskId' });
ActivityLog.belongsTo(User, { foreignKey: 'actorUserId', as: 'ActorUser' });
ActivityLog.belongsTo(Agent, { foreignKey: 'actorAgentId', as: 'ActorAgent' });

Tenant.hasMany(Reassignment, { foreignKey: 'tenantId' });
Reassignment.belongsTo(Tenant, { foreignKey: 'tenantId' });
Task.hasMany(Reassignment, { foreignKey: 'taskId' });
Reassignment.belongsTo(Task, { foreignKey: 'taskId' });
Reassignment.belongsTo(User, { foreignKey: 'actorUserId', as: 'ActorUser' });

Tenant.hasMany(TenantInvitation, { foreignKey: 'tenantId' });
TenantInvitation.belongsTo(Tenant, { foreignKey: 'tenantId' });

Tenant.hasMany(TaskComment, { foreignKey: 'tenantId' });
TaskComment.belongsTo(Tenant, { foreignKey: 'tenantId' });
Task.hasMany(TaskComment, { foreignKey: 'taskId' });
TaskComment.belongsTo(Task, { foreignKey: 'taskId' });
TaskComment.belongsTo(User, { foreignKey: 'authorUserId', as: 'AuthorUser' });

Tenant.hasMany(UserNotification, { foreignKey: 'tenantId' });
UserNotification.belongsTo(Tenant, { foreignKey: 'tenantId' });
User.hasMany(UserNotification, { foreignKey: 'userId' });
UserNotification.belongsTo(User, { foreignKey: 'userId' });

Tenant.hasMany(RecurringTaskRule, { foreignKey: 'tenantId' });
RecurringTaskRule.belongsTo(Tenant, { foreignKey: 'tenantId' });
Project.hasMany(RecurringTaskRule, { foreignKey: 'projectId' });
RecurringTaskRule.belongsTo(Project, { foreignKey: 'projectId' });
Board.hasMany(RecurringTaskRule, { foreignKey: 'boardId' });
RecurringTaskRule.belongsTo(Board, { foreignKey: 'boardId' });

Tenant.hasMany(ImportJob, { foreignKey: 'tenantId' });
ImportJob.belongsTo(Tenant, { foreignKey: 'tenantId' });
Project.hasMany(ImportJob, { foreignKey: 'projectId' });
ImportJob.belongsTo(Project, { foreignKey: 'projectId' });
User.hasMany(ImportJob, { foreignKey: 'userId' });
ImportJob.belongsTo(User, { foreignKey: 'userId' });
Board.hasOne(ImportJob, { foreignKey: 'boardId' });
ImportJob.belongsTo(Board, { foreignKey: 'boardId' });

Tenant.hasMany(Document, { foreignKey: 'tenantId' });
Document.belongsTo(Tenant, { foreignKey: 'tenantId' });
Project.hasMany(Document, { foreignKey: 'projectId' });
Document.belongsTo(Project, { foreignKey: 'projectId' });
Document.belongsTo(User, { foreignKey: 'createdBy', as: 'Creator' });
Document.belongsTo(User, { foreignKey: 'updatedBy', as: 'Updater' });

Tenant.hasMany(Form, { foreignKey: 'tenantId' });
Form.belongsTo(Tenant, { foreignKey: 'tenantId' });
Project.hasMany(Form, { foreignKey: 'projectId' });
Form.belongsTo(Project, { foreignKey: 'projectId' });
Board.hasMany(Form, { foreignKey: 'boardId' });
Form.belongsTo(Board, { foreignKey: 'boardId' });

export {
  sequelize,
  User,
  Tenant,
  TenantMembership,
  SubscriptionPlan,
  TenantSubscription,
  TenantUsage,
  RefreshToken,
  Project,
  Board,
  ProjectMember,
  EmployeeProfile,
  Agent,
  Task,
  ActivityLog,
  Reassignment,
  StripeEvent,
  TenantInvitation,
  TaskComment,
  UserNotification,
  RecurringTaskRule,
  ContactSalesLead,
  TaskRelation,
  ImportJob,
  Document,
  Form,
};
