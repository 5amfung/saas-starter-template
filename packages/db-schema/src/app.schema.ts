import { relations } from 'drizzle-orm';
import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { organization, user } from './auth.schema';

export const notificationPreferences = pgTable('notification_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  marketingEmails: boolean('marketing_emails').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    user: one(user, {
      fields: [notificationPreferences.userId],
      references: [user.id],
    }),
  })
);

export const workspaceEntitlementOverrides = pgTable(
  'workspace_entitlement_override',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .unique()
      .references(() => organization.id, { onDelete: 'cascade' }),
    // JSONB columns use Record<string, ...> because Drizzle can't enforce
    // key unions at the DB layer. Callers must cast to EntitlementOverrides
    // (keyed by LimitKey/FeatureKey/QuotaKey) at the read boundary.
    limits: jsonb('limits').$type<Partial<Record<string, number>>>(),
    features: jsonb('features').$type<Partial<Record<string, boolean>>>(),
    quotas: jsonb('quotas').$type<Partial<Record<string, number>>>(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

export const workspaceEntitlementOverridesRelations = relations(
  workspaceEntitlementOverrides,
  ({ one }) => ({
    workspace: one(organization, {
      fields: [workspaceEntitlementOverrides.workspaceId],
      references: [organization.id],
    }),
  })
);
