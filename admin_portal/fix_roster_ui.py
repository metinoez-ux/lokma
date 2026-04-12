import re

file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesRosterTab.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Insert helper functions for initials and color styling right before the return statement inside the component.
helper_search = r"""  return \("""
helper_replace = """  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'genel sorumlu': return 'bg-purple-500/10 text-purple-400 border-purple-500/20 ring-purple-500/30';
      case 'garson': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 ring-emerald-500/30';
      case 'sürücü / nakliye': return 'bg-amber-500/10 text-amber-400 border-amber-500/20 ring-amber-500/30';
      case 'ocakbaşı - kumpir': return 'bg-orange-500/10 text-orange-400 border-orange-500/20 ring-orange-500/30';
      case 'güvenlik': return 'bg-slate-500/10 text-slate-400 border-slate-500/20 ring-slate-500/30';
      case 'temizlik': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20 ring-cyan-500/30';
      case 'tatlı standı': return 'bg-pink-500/10 text-pink-400 border-pink-500/20 ring-pink-500/30';
      case 'içecek standı': return 'bg-blue-500/10 text-blue-400 border-blue-500/20 ring-blue-500/30';
      case 'gözleme': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 ring-yellow-500/30';
      default: return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20 ring-zinc-500/30';
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return ("""
content = content.replace(helper_search, helper_replace)


# 2. Re-write the rendering of the roster card list
card_search = r"""                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">.*?</div>\n                </div>\n              \);\n            \}\)\}\n          </div>"""

card_replace = """                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedRosters[dateStr].map(roster => {
                      const staffName = getUserName(roster.userId);
                      const roleBadge = getRoleColor(roster.role);
                      return (
                        <div key={roster.id} className="group relative bg-card/60 hover:bg-card border border-border hover:border-blue-500/30 rounded-xl p-4 transition-all duration-300 flex items-start gap-4 shadow-sm hover:shadow-md overflow-hidden">
                          {/* Accent line based on role */}
                          <div className={`absolute top-0 left-0 w-1 h-full ${roleBadge.split(' ')[0]} rounded-l-xl opacity-50`}></div>
                          
                          {/* Avatar Circle */}
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-600/20 to-indigo-600/20 border border-blue-500/20 flex items-center justify-center font-bold text-sm text-blue-300 shrink-0 shadow-inner">
                            {getInitials(staffName)}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center pt-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-bold text-foreground text-sm truncate tracking-tight">{staffName}</p>
                              
                              <button 
                                onClick={() => handleDelete(roster.id)}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 hover:bg-red-500/10 rounded-md transition-all p-1.5 -mr-1.5 -mt-1.5"
                                title="Vardiyayı Sil"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>

                            <span className={`inline-flex items-center rounded-full mt-1.5 px-2 py-0.5 text-[10px] font-semibold border ${roleBadge} w-max`}>
                              {roster.role}
                            </span>
                            
                            <div className="flex items-center gap-1.5 mt-2.5 text-xs font-semibold text-muted-foreground bg-black/20 px-2 py-1 rounded border border-white/5 w-max">
                              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-blue-100">{roster.startTime} - {roster.endTime}</span>
                            </div>
                          </div>
                          
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>"""

content = re.sub(card_search, card_replace, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Redesigned Card UI updated successfully.")
