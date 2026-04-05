const fs = require('fs');
let code = fs.readFileSync('views/AdminDashboard.tsx', 'utf8');

function replaceBlock(startMarker, endMarker, replacement) {
   let p1 = code.indexOf(startMarker);
   let p2 = code.indexOf(endMarker, p1);
   if (p1 === -1 || p2 === -1) {
      console.log('FAILED TO MATCH:\n' + startMarker.substring(0, 50));
      return;
   }
   code = code.substring(0, p1) + replacement + code.substring(p2 + endMarker.length);
}

// 1. Add Filter states
replaceBlock('  const [activeTab', '  const [searchQuery', `  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [statPeriod, setStatPeriod] = useState<'today' | 'week' | 'month' | 'year'>('today');
  
  const [bookingsPage, setBookingsPage] = useState(1);
  const [bookingDateFrom, setBookingDateFrom] = useState('');
  const [bookingDateTo, setBookingDateTo] = useState('');
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL');
  const bookingsPerPage = 20;

  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [searchQuery`);

// 2. Add Stats Calculation
replaceBlock('  // Calculate Stats', '  const pendingReviews', `  // Calculate Stats
  const now = new Date();
  const todayIso = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}-\${String(now.getDate()).padStart(2, '0')}\`;
  
  const getPeriodStart = () => {
    const d = new Date(now);
    if (statPeriod === 'today') return todayIso;
    if (statPeriod === 'week') { d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; }
    if (statPeriod === 'month') { d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; }
    if (statPeriod === 'year') { d.setFullYear(d.getFullYear() - 1); return d.toISOString().split('T')[0]; }
    return todayIso;
  };
  const periodStartIso = getPeriodStart();
  
  const periodBookings = bookings.filter(b => b.date >= periodStartIso && b.date <= todayIso);
  const paidPeriodBookings = periodBookings.filter(b => b.status === 'COMPLETED');
  const dashboardRevenue = paidPeriodBookings.reduce((acc, b) => acc + b.totalPrice, 0);
  const totalBookings = periodBookings.length;
  const completedBookings = paidPeriodBookings.length;
  const pendingReviews`);

replaceBlock('  // Prepare Chart Data', '  const tabs', `  // Prepare Chart Data
  let chartData = [];
  if (statPeriod === 'today') {
    const chartHours = ['10:00', '12:00', '14:00', '16:00', '18:00', '20:00'];
    chartData = chartHours.map((hour) => ({
      name: hour,
      revenue: paidPeriodBookings
        .filter((b) => b.time === hour && b.date === todayIso)
        .reduce((sum, booking) => sum + booking.totalPrice, 0),
    }));
  } else {
    const revByDate = {};
    for (const b of paidPeriodBookings) {
      revByDate[b.date] = (revByDate[b.date] || 0) + b.totalPrice;
    }
    chartData = Object.keys(revByDate).sort().map(d => ({
      name: d.split('-').slice(1).join('.'),
      revenue: revByDate[d]
    }));
  }

  const tabs`);

replaceBlock('  const DashboardContent = () => (', '      {/* KPI Cards */}', `  const DashboardContent = () => (
    <>
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-white font-serif text-xl">Аналитика</h3>
        <select 
          value={statPeriod} 
          onChange={e => setStatPeriod(e.target.value as any)}
          className="bg-zinc-800 border border-zinc-700 text-sm p-2 text-white outline-none focus:border-gold-500 rounded"
        >
          <option value="today">Сегодня</option>
          <option value="week">За 7 дней</option>
          <option value="month">За 30 дней</option>
          <option value="year">За год</option>
        </select>
      </div>
      {/* KPI Cards */}`);

code = code.replace(/Выручка за сегодня/g, 'Выручка за период')
    .replace(/Записей сегодня/g, 'Записей за период')
    .replace(/dashboardRevenueToday/g, 'dashboardRevenue');

// 3. Add Bookings Export and Pagination
replaceBlock('  // Bookings Tab', '          <div className="relative">', `  const exportBookingsToCSV = () => {
    const csvContent = ["ID\\tDate\\tTime\\tClient\\tPhone\\tService\\tMaster\\tStatus\\tPrice"];
    filteredBookings.forEach(b => {
      const master = masters.find(m => m.id === b.masterId)?.name || '';
      csvContent.push(\`\${b.id}\\t\${b.date}\\t\${b.time}\\t\${b.clientName}\\t\${b.clientPhone}\\t\${b.serviceId}\\t\${master}\\t\${b.status}\\t\${b.totalPrice}\`);
    });
    const blob = new Blob([csvContent.join('\\n')], { type: 'text/tsv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bookings.tsv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredBookings = bookings
    .filter(b => !searchQuery || b.clientName.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter(b => !bookingDateFrom || b.date >= bookingDateFrom)
    .filter(b => !bookingDateTo || b.date <= bookingDateTo)
    .filter(b => bookingStatusFilter === 'ALL' || b.status === bookingStatusFilter)
    .sort((a, b) => new Date(\`\${b.date}T\${b.time}\`).getTime() - new Date(\`\${a.date}T\${a.time}\`).getTime());
    
  const totalPages = Math.max(1, Math.ceil(filteredBookings.length / bookingsPerPage));
  const paginatedBookings = filteredBookings.slice((bookingsPage - 1) * bookingsPerPage, bookingsPage * bookingsPerPage);

  // Bookings Tab
  const BookingsContent = () => (
    <Card className="p-0 overflow-hidden min-h-[500px] flex flex-col">
      <div className="p-6 border-b border-zinc-800 flex flex-col xl:flex-row justify-between gap-4">
        <h3 className="text-white font-serif whitespace-nowrap">Все записи ({filteredBookings.length})</h3>
        <div className="flex flex-wrap gap-2 flex-1 xl:justify-end">
          <div className="relative">`);

replaceBlock('            <Search', '            <div className="overflow-x-auto">', `            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" placeholder="Поиск по клиенту" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setBookingsPage(1); }} className="pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm w-full focus:border-gold-500 outline-none" />
          </div>
          <input type="date" value={bookingDateFrom} onChange={e => { setBookingDateFrom(e.target.value); setBookingsPage(1); }} className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm focus:border-gold-500 outline-none" />
          <input type="date" value={bookingDateTo} onChange={e => { setBookingDateTo(e.target.value); setBookingsPage(1); }} className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm focus:border-gold-500 outline-none" />
          <select value={bookingStatusFilter} onChange={e => { setBookingStatusFilter(e.target.value); setBookingsPage(1); }} className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm focus:border-gold-500 outline-none">
            <option value="ALL">Все статусы</option>
            <option value="PENDING">Ожидает</option>
            <option value="CONFIRMED">Подтверждена</option>
            <option value="IN_PROGRESS">В работе</option>
            <option value="COMPLETED">Завершена</option>
            <option value="CANCELLED">Отменена</option>
            <option value="NO_SHOW">Неявка</option>
          </select>
          <button onClick={exportBookingsToCSV} className="px-3 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm hover:bg-zinc-700 shrink-0">Экспорт TSV</button>
        </div>
      </div>
      <div className="overflow-x-auto">`);

code = code.replace(/\{bookings\n\s*\.filter[\s\S]*?map\(\(booking\) => \(/g, '{paginatedBookings.map((booking) => (');

replaceBlock('              </tr>\n            ))}\n          </tbody>\n        </table>\n      </div>\n    </Card>\n  );\n\n  // Services Tab', '  // Services Tab', `              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-auto p-4 border-t border-zinc-800 flex justify-between items-center bg-zinc-950">
        <span className="text-sm text-zinc-500">Показано {paginatedBookings.length} из {filteredBookings.length}</span>
        <div className="flex gap-2">
          <button disabled={bookingsPage === 1} onClick={() => setBookingsPage(p => p - 1)} className="px-3 py-1 bg-zinc-800 text-sm text-white disabled:opacity-50 border border-zinc-700">Назад</button>
          <span className="px-3 py-1 text-sm text-zinc-400">Стр. {bookingsPage} из {totalPages}</span>
          <button disabled={bookingsPage === totalPages} onClick={() => setBookingsPage(p => p + 1)} className="px-3 py-1 bg-zinc-800 text-sm text-white disabled:opacity-50 border border-zinc-700">Вперед</button>
        </div>
      </div>
    </Card>
  );

  // Services Tab`);

replaceBlock('          <div className="text-zinc-500 text-sm">{clients.length} клиентов</div>\n        </div>\n      </div>', '      </div>', `          <div className="text-zinc-500 text-sm">{clients.length} клиентов</div>
        </div>
        <button onClick={() => {
          const csvContent = ["Client\\tPhone\\tEmail\\tVisits\\tSpent\\tLastVisit"];
          clients.forEach(c => csvContent.push(\`\${c.name}\\t\${c.phone}\\t\${c.email || ''}\\t\${c.totalVisits}\\t\${c.totalSpent}\\t\${c.lastVisit || ''}\`));
          const blob = new Blob([csvContent.join('\\n')], { type: 'text/tsv;charset=utf-8;' });
          const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "clients.tsv";
          document.body.appendChild(link); link.click(); document.body.removeChild(link);
        }} className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-white text-sm hover:bg-zinc-700 block">Экспорт TSV</button>
      </div>`);

// Modifying the Users Tab to include UserModal logic
replaceBlock('                  <div className="flex gap-1 justify-end">\n                    <button className="p-1 text-zinc-500 hover:text-gold-500 transition-colors" title="Редактировать">\n                      <Edit2 size={14} />\n                    </button>\n                    <button className={`p-1 transition-colors ${user.isActive ? \'text-zinc-500 hover:text-red-500\' : \'text-zinc-500 hover:text-green-500\'}`} title={user.isActive ? \'Деактивировать\' : \'Активировать\'}>\n                      {user.isActive ? <Lock size={14} /> : <Check size={14} />}\n                    </button>\n                  </div>', '                  </div>', `                  <div className="flex gap-1 justify-end">
                    <button onClick={() => setEditingUser(user)} className="p-1 text-zinc-500 hover:text-gold-500 transition-colors" title="Редактировать">
                      <Edit2 size={14} />
                    </button>
                    {user.id !== currentUser.id && (
                      <button 
                        onClick={() => {
                          const action = user.isActive ? 'деактивировать' : 'активировать';
                          if (window.confirm(\`Вы уверены, что хотите \${action} пользователя "\${user.name}"?\`)) {
                            // @ts-ignore
                            if (typeof onUpdateUser === 'function') onUpdateUser(user.id, { isActive: !user.isActive });
                          }
                        }}
                        className={\`p-1 transition-colors \${user.isActive ? 'text-zinc-500 hover:text-red-500' : 'text-zinc-500 hover:text-green-500'}\`} 
                        title={user.isActive ? 'Деактивировать' : 'Активировать'}
                      >
                        {user.isActive ? <Lock size={14} /> : <Check size={14} />}
                      </button>
                    )}
                  </div>`);

replaceBlock('    </Card>\n  );\n\n  // Waitlist Tab', '  // Waitlist Tab', `    </Card>
    {editingUser && (
      <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-800 p-6 md:p-8 w-full max-w-md my-auto flex flex-col max-h-[90vh]">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-white font-serif text-2xl">Редактировать аккаунт</h3>
            <button onClick={() => setEditingUser(null)} className="text-zinc-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
          <div className="overflow-y-auto pr-2 custom-scrollbar">
            <form onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              // @ts-ignore
              if (typeof onUpdateUser === 'function') onUpdateUser(editingUser.id, Object.fromEntries(f));
              setEditingUser(null);
            }} className="space-y-6">
              <div><label className="block text-zinc-500 text-xs uppercase mb-2">ФИО</label><input type="text" name="name" required defaultValue={editingUser.name} className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none" /></div>
              <div><label className="block text-zinc-500 text-xs uppercase mb-2">Email</label><input type="email" name="email" required defaultValue={editingUser.email} className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none" /></div>
              <div>
                <label className="block text-zinc-500 text-xs uppercase mb-2">Роль</label>
                <select name="role" defaultValue={editingUser.role} disabled={editingUser.id === currentUser.id} className="w-full bg-zinc-800 border border-zinc-700 p-3 text-white focus:border-gold-500 outline-none disabled:opacity-50">
                  <option value="CLIENT">Клиент</option>
                  <option value="MASTER">Стилист</option>
                  <option value="ADMIN">Администратор</option>
                </select>
                {editingUser.id === currentUser.id && <p className="text-xs text-red-400 mt-1">Нельзя изменить свою собственную роль</p>}
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setEditingUser(null)} className="flex-1">Отмена</Button>
                <Button type="submit" className="flex-1">Сохранить</Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    )}
  </>
  );

  // Waitlist Tab`);


// Fix missing onUpdateUser prop by replacing AdminDashboardProps interface slightly
code = code.replace(/onUpdateBooking: \(id: string, updates: Partial<Booking>\) => void;/g, 'onUpdateBooking: (id: string, updates: Partial<Booking>) => void;\n  onUpdateUser?: (id: string, updates: Partial<User>) => void;');
code = code.replace(/onUpdateBooking,\n\s*onLogout/g, 'onUpdateBooking,\n  onUpdateUser,\n  onLogout');

fs.writeFileSync('views/AdminDashboard.tsx', code);
console.log('Script execution complete.');
