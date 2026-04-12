import re

file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/[id]/KermesRosterTab.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

grouping_search = r"""                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">.*?</div>\n                </div>\n              \);\n            \}\)\}\n          </div>"""

grouping_replace = """                  <div className="space-y-6 mt-6">
                    {Object.entries(groupedRosters[dateStr].reduce((acc, roster) => {
                      if (!acc[roster.role]) acc[roster.role] = [];
                      acc[roster.role].push(roster);
                      return acc;
                    }, {} as Record<string, typeof groupedRosters[string]>)).sort().map(([role, list]) => {
                      const roleBadge = getRoleColor(role);
                      const borderColor = roleBadge.match(/border-([a-z]+-[0-9]+)/)?.[0] || 'border-border';
                      const bgColor = roleBadge.match(/bg-([a-z]+-[0-9]+)\/10/)?.[0] || 'bg-muted';
                      const textColor = roleBadge.match(/text-([a-z]+-[0-9]+)/)?.[0] || 'text-foreground';
                      
                      return (
                        <div key={role} className="relative bg-card/30 border border-border rounded-2xl p-4 shadow-sm">
                          {/* Role Header */}
                          <div className={`flex items-center gap-3 mb-4 pb-3 border-b ${borderColor}/20`}>
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgColor}/20 ${textColor} ${borderColor}`}>
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="flex flex-col">
                              <h5 className={`font-bold text-base ${textColor}`}>{role}</h5>
                              <span className="text-xs font-semibold text-muted-foreground">{list.length} Personel Görevlendirildi</span>
                            </div>
                          </div>
                          
                          {/* Cards Grid under this Role */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            {list.map(roster => {
                              const staffName = getUserName(roster.userId);
                              return (
                                <div key={roster.id} className={`group relative ${bgColor}/5 hover:${bgColor}/10 border ${borderColor}/30 rounded-xl p-3 flex items-center gap-3 transition-colors cursor-default`}>
                                  
                                  {/* Avatar */}
                                  <div className={`w-10 h-10 rounded-full ${bgColor}/20 border ${borderColor}/50 flex items-center justify-center font-bold text-sm ${textColor} shadow-inner`}>
                                    {getInitials(staffName)}
                                  </div>
                                  
                                  {/* Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-foreground text-sm truncate">{staffName}</p>
                                    <div className={`flex items-center gap-1.5 mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${bgColor}/20 ${textColor} w-max border ${borderColor}/30`}>
                                      <svg className="w-3.5 h-3.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>{roster.startTime} - {roster.endTime}</span>
                                    </div>
                                  </div>
                                  
                                  {/* Delete Action */}
                                  <button 
                                    onClick={() => handleDelete(roster.id)}
                                    className="opacity-0 group-hover:opacity-100 text-red-500 hover:bg-red-500/10 rounded-md transition-all p-1.5 absolute right-2 top-1/2 -translate-y-1/2"
                                    title="Vardiyayı Sil"
                                  >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                  
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>"""

content = re.sub(grouping_search, grouping_replace, content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Grouped Roster UI updated successfully.")
