import re
file_path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/kermes/page.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

replacement = """  })}
  </div>
  
  {/* Pagination Controls */}
  {totalPages > 1 && (
    <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4 bg-card p-4 rounded-xl border border-border mt-auto">
      <div className="text-sm text-muted-foreground order-2 sm:order-1">
        Toplam <span className="font-bold text-foreground">{filteredEvents.length}</span> kermes, 
        Sayfa <span className="font-bold text-foreground">{currentPage}</span> / {totalPages}
      </div>
      <div className="flex items-center gap-2 order-1 sm:order-2">
        <button
          onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-muted text-foreground/80 hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition"
        >
          {t('onceki')}
        </button>
        <div className="flex gap-1 overflow-x-auto custom-scrollbar px-2 max-w-[200px] sm:max-w-none">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i + 1}
              onClick={() => setCurrentPage(i + 1)}
              className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg text-sm font-bold transition ${
                currentPage === i + 1 
                  ? 'bg-pink-600 text-white shadow-md' 
                  : 'bg-muted/50 text-foreground/80 hover:bg-muted'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <button
          onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
          disabled={currentPage === totalPages}
          className="px-4 py-2 bg-muted text-foreground/80 hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition"
        >
          {t('sonraki')}
        </button>
      </div>
    </div>
  )}
  )}"""

new_text = re.sub(r'  \}\)}\s*</div>\s*\)}', replacement, text)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_text)

print("regex SUCCESS")
