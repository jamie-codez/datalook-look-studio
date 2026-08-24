import {AuthProvider} from "@/components/providers/auth-provider"
import {WorkspaceProvider} from "@/components/providers/workspace-provider"
import {WorkspaceShell} from "@/components/workspace/workspace-shell"

export default function Page() {
    return (
        <AuthProvider>
            <WorkspaceProvider>
                <WorkspaceShell/>
            </WorkspaceProvider>
        </AuthProvider>
    )
}
