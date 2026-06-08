import { allCrudResources } from '../config/resources.js'
import { inferColumnType } from './column-type-inference.js'
import { toSnakeCase } from '../shared/utils/case-converters.js'
import type { ResourceDefinition } from '../shared/types/domain.js'

function columnName(field: string, resource: ResourceDefinition): string {
  return resource.fieldMap?.[field] || toSnakeCase(field)
}

export function buildSchemaStatements(): string[] {
  const statements: string[] = []

  for (const resource of allCrudResources) {
    statements.push(buildCreateTable(resource))
    statements.push(...buildMissingColumnStatements(resource))
    statements.push(...buildColumnTypeCorrectionStatements(resource))
    statements.push(...buildDataBackfillStatements(resource))
    statements.push(...buildIndexStatements(resource))
  }

  return statements
}

function buildCreateTable(resource: ResourceDefinition): string {
  return `
IF OBJECT_ID(N'[dbo].[${resource.table}]', N'U') IS NULL
BEGIN
  CREATE TABLE [dbo].[${resource.table}] (
    [id] NVARCHAR(80) NOT NULL CONSTRAINT [PK_${resource.table}] PRIMARY KEY,
    [deleted_at] DATETIME2 NULL
  );
END;`
}

function buildMissingColumnStatements(resource: ResourceDefinition): string[] {
  return resource.fields
    .filter((field) => field !== 'id')
    .map((field) => {
      const column = columnName(field, resource)

      return `
IF COL_LENGTH('[dbo].[${resource.table}]', '${column}') IS NULL
BEGIN
  ALTER TABLE [dbo].[${resource.table}] ADD [${column}] ${inferColumnType(field, resource)} NULL;
END;`
    })
}

function buildDataBackfillStatements(resource: ResourceDefinition): string[] {
  if (resource.table === 'user_role_assignments') {
    return [
      `
IF COL_LENGTH('[dbo].[user_role_assignments]', 'is_active') IS NOT NULL
BEGIN
  UPDATE [dbo].[user_role_assignments]
  SET [is_active] = COALESCE([is_active], 1)
  WHERE [deleted_at] IS NULL;
END;`,
    ]
  }

  if (!['alert_subscriptions', 'communication_conversations', 'communication_messages', 'communication_profiles', 'communication_provider_configs', 'communication_quote_links', 'customers', 'diagnostics', 'driver_documents', 'driver_fines', 'driver_trip_sheets', 'freight_assignments', 'mechanic_specialties', 'notifications', 'parts', 'purchase_orders', 'suppliers', 'tire_lifecycles', 'truck_documents', 'warehouse_locations'].includes(resource.table)) {
    return []
  }

  return [
    `
IF COL_LENGTH('[dbo].[${resource.table}]', 'created_by') IS NOT NULL
BEGIN
  UPDATE [dbo].[${resource.table}]
  SET [created_by] = COALESCE([created_by], N'Sistema'),
      [updated_by] = COALESCE([updated_by], [created_by], N'Sistema')
  WHERE [deleted_at] IS NULL;
END;`,
  ]
}

function buildColumnTypeCorrectionStatements(resource: ResourceDefinition): string[] {
  const statements: string[] = []

  if (resource.table === 'truck_costs') {
    statements.push(
    `
IF EXISTS (
  SELECT 1
  FROM sys.columns columns
  JOIN sys.types types ON columns.user_type_id = types.user_type_id
  WHERE columns.object_id = OBJECT_ID(N'[dbo].[truck_costs]')
    AND columns.name = N'cost_type'
    AND types.name NOT IN (N'nvarchar', N'varchar')
)
BEGIN
  IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_truck_costs_cost_type' AND object_id = OBJECT_ID(N'[dbo].[truck_costs]'))
  BEGIN
    DROP INDEX [IX_truck_costs_cost_type] ON [dbo].[truck_costs];
  END;

  ALTER TABLE [dbo].[truck_costs] ALTER COLUMN [cost_type] NVARCHAR(255) NULL;
END;`,
    )
  }

  if (resource.table === 'freight_quotes') {
    statements.push(
      `
IF EXISTS (
  SELECT 1
  FROM sys.columns columns
  JOIN sys.types types ON columns.user_type_id = types.user_type_id
  WHERE columns.object_id = OBJECT_ID(N'[dbo].[freight_quotes]')
    AND columns.name = N'base_rate'
    AND types.name NOT IN (N'decimal', N'numeric')
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM [dbo].[freight_quotes]
    WHERE [base_rate] IS NOT NULL
      AND TRY_CONVERT(DECIMAL(18, 4), [base_rate]) IS NULL
  )
  BEGIN
    THROW 50001, 'freight_quotes.base_rate contains non numeric data and cannot be migrated safely.', 1;
  END;

  ALTER TABLE [dbo].[freight_quotes] ALTER COLUMN [base_rate] DECIMAL(18, 4) NULL;
END;`,
    )
  }

  return statements
}

function buildIndexStatements(resource: ResourceDefinition): string[] {
  return [...new Set([...(resource.filterFields || []), ...(resource.sortFields || [])])]
    .filter((field) => resource.fields.includes(field))
    .slice(0, 8)
    .map((field) => {
      const column = columnName(field, resource)
      const indexName = `IX_${resource.table}_${column}`.slice(0, 120)

      return `
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = '${indexName}' AND object_id = OBJECT_ID('[dbo].[${resource.table}]'))
BEGIN
  CREATE INDEX [${indexName}] ON [dbo].[${resource.table}] ([${column}]);
END;`
    })
}
