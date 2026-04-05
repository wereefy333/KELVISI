const fs = require('fs');
let c = fs.readFileSync('views/AdminDashboard.tsx', 'utf8');

const userModalCode = `
  const UserModal = ({ user, onClose, onUpdate }: { user: User; onClose: () => void; onUpdate: (id: string, updates: Partial<User>) => void }) => {
    const [formData, setFormData] = useState({ name: user.name, email: user.email, role: user.role });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setIsSaving(true);
      try {
        await onUpdate(user.id, formData);
        onClose();
      } finally {
        setIsSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 w-full max-w-md my-auto flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-white font-serif text-2xl">Редактировать аккаунт</h3>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
          <div className="overflow-y-auto pr-2 custom-scrollbar">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">ФИО</label>
                <input type="text" required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none" />
              </div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Email</label>
                <input type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none" />
              </div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Роль</label>
                <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none">
                  <option value="CLIENT">Клиент</option>
                  <option value="MASTER">Стилист</option>
                  <option value="ADMIN">Администратор</option>
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Отмена</Button>
                <Button type="submit" className="flex-1" disabled={isSaving}>{isSaving ? 'Сохранение...' : 'Сохранить'}</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  const createDefaultScheduleForm = (): MasterScheduleForm => ({`;

c = c.replace(/const createDefaultScheduleForm = \(\): MasterScheduleForm => \(\{/g, userModalCode);

const tableButtons = `
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setEditingUser(user)} className="p-1 text-zinc-500 hover:text-gold-500 transition-colors" title="Редактировать">
                      <Edit2 size={14} />
                    </button>
                    {user.id !== currentUser.id && (
                      <button onClick={() => {
                          const action = user.isActive ? 'деактивировать' : 'активировать';
                          if (window.confirm(\`Вы уверены, что хотите \${action} пользователя "\${user.name}"?\`)) {
                            onUpdateUser?.(user.id, { isActive: !user.isActive });
                          }
                        }}
                        className={\`p-1 transition-colors \${user.isActive ? 'text-zinc-500 hover:text-red-500' : 'text-zinc-500 hover:text-green-500'}\`} 
                        title={user.isActive ? 'Деактивировать' : 'Активировать'}>
                        {user.isActive ? <Lock size={14} /> : <Check size={14} />}
                      </button>
                    )}
                  </div>`;

c = c.replace(/<div className="flex gap-1 justify-end">[\s\S]*?<Lock size=\{14\} \/> : <Check size=\{14\} \/>\}[\s\S]*?<\/button>\s*<\/div>/g, tableButtons);

const modalRender = `
      </Card>
      {editingUser && onUpdateUser && (
        <UserModal user={editingUser} onClose={() => setEditingUser(null)} onUpdate={onUpdateUser} />
      )}
    </>
  );

  // Waitlist Tab`;

c = c.replace(/<\/Card>\s*<\/>\s*\);\s*\/\/\s*Waitlist Tab/g, modalRender);

fs.writeFileSync('views/AdminDashboard.tsx', c);
console.log("Successfully ran node script");
