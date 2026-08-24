"use client"

import type { Tab } from "@/lib/types"
import { SqlEditorTab } from "@/components/workspace/tabs/sql-editor-tab"
import { DataGridTab } from "@/components/workspace/tabs/data-grid-tab"
import { PropertiesTab } from "@/components/workspace/tabs/properties-tab"
import { ServerStatusTab } from "@/components/workspace/tabs/server-status-tab"
import { UserManagementTab } from "@/components/workspace/tabs/user-management-tab"
import { AuditLogTab } from "@/components/workspace/tabs/audit-log-tab"
import { SettingsTab } from "@/components/workspace/tabs/settings-tab"
import { AdminConsoleTab } from "@/components/workspace/tabs/admin-console-tab"

/**
 * Renders every open tab, keeping non-active tabs mounted but hidden so their
 * local state (SQL text, results, scroll) survives tab switches — matching how
 * a desktop DB client behaves.
 */
export function TabContent({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <div
      role="tabpanel"
      hidden={!active}
      className="h-full min-h-0"
      // keep mounted; just visually hide
      style={active ? undefined : { display: "none" }}
    >
      {tab.kind === "sql" && <SqlEditorTab tab={tab} active={active} />}
      {tab.kind === "data" && <DataGridTab tab={tab} />}
      {tab.kind === "properties" && <PropertiesTab tab={tab} />}
      {tab.kind === "server-status" && <ServerStatusTab tab={tab} />}
      {tab.kind === "users" && <UserManagementTab />}
      {tab.kind === "audit" && <AuditLogTab />}
      {tab.kind === "settings" && <SettingsTab />}
      {tab.kind === "admin" && <AdminConsoleTab />}
    </div>
  )
}
