// ARCHIVED LEGACY TV LOGIC (Prior to DeliveryZones)
// Filename: kermes-tv/page.tsx (old snippet)
// Explanation: Used ?section= parameter to filter TVs based on prepZones or tableSections in an OR fashion.

/*
        if (sectionFilter) {
          // Eski (Legacy) Filtreleme
          const filterNorm = normalizeForSearch(sectionFilter);
          const orderSectionNorm = normalizeForSearch(data.tableSection as string | undefined);
          
          let matchesSection = false;
          if (filterNorm && orderSectionNorm) {
            matchesSection = orderSectionNorm === filterNorm || orderSectionNorm.includes(filterNorm) || filterNorm.includes(orderSectionNorm);
          }
          
          const items = (data.items as Array<any>) || [];
          const matchesPrepZone = items.some(
            (item) => {
              const pz = item.prepZones || item.prepZone;
              if (!pz) return false;
              if (Array.isArray(pz)) {
                return pz.some((z: string) => normalizeForSearch(z).includes(filterNorm));
              } else if (typeof pz === 'string') {
                return normalizeForSearch(pz).includes(filterNorm);
              }
              return false;
            }
          );

          if (!matchesSection && !matchesPrepZone) {
            return;
          }
        }
*/

// shift_dashboard_tab.dart (old fallback)
/*
        if (rawSections is List) {
          // List formatinda: [{id: 'kadin_bolumu', label: 'Kadin Bolumu'}, ...] veya dizgisal ['kadinlar', 'erkekler']
          for (final item in rawSections) { ... }
        } else if (rawSections is Map) {
          // Map formatinda: {kadin_bolumu: {label: 'Kadin Bolumu'}, ...}
          for (final entry in rawSections.entries) { ...  }
        }
*/
