import { useMembers } from "@/features/members/hooks/use-members";

export function MembersPage() {
  const { data: members = [], isPending, isError } = useMembers();

  return (
    <div className="p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Members</h1>

          <p className="mt-1 text-sm text-muted-foreground">People with access to the INVS Studio workspace.</p>
        </div>

        {isPending ? <p className="text-sm text-muted-foreground">Loading members…</p> : null}

        {isError ? <p className="text-sm text-destructive">Unable to load members.</p> : null}

        {members.length > 0 ? (
          <div className="divide-y rounded-lg border">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt="" className="size-8 rounded-full" />
                ) : (
                  <div className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium">{member.displayName.charAt(0).toUpperCase()}</div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{member.displayName}</p>

                  <p className="text-xs capitalize text-muted-foreground">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
