import { permissionCatalog, permissionKeys, type PermissionKey } from "../../../../shared/permissions";

const permissionGroups = Array.from(new Set(permissionCatalog.map((permission) => permission.group)));

export function PermissionSelector({ value, onChange, disabled = false }: { value: PermissionKey[]; onChange: (permissions: PermissionKey[]) => void; disabled?: boolean }) {
  const selected = new Set(value);

  const fullControl = permissionKeys.every((permission) => selected.has(permission));

  function togglePermission(permission: PermissionKey) {
    const next = new Set(value);

    if (next.has(permission)) {
      next.delete(permission);
    } else {
      next.add(permission);
    }

    onChange(permissionKeys.filter((key) => next.has(key)));
  }

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
        <input
          type="checkbox"
          checked={fullControl}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.checked ? [...permissionKeys] : []);
          }}
        />

        <div>
          <p className="text-sm font-medium">Full control</p>

          <p className="text-xs text-muted-foreground">Enable every Flow permission for this role.</p>
        </div>
      </label>

      {permissionGroups.map((group) => (
        <div key={group} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{group}</p>

          <div className="grid gap-2 sm:grid-cols-2">
            {permissionCatalog
              .filter((permission) => permission.group === group)
              .map((permission) => (
                <label key={permission.key} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={selected.has(permission.key)}
                    onChange={() => {
                      togglePermission(permission.key);
                    }}
                  />

                  <span>{permission.label}</span>
                </label>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
