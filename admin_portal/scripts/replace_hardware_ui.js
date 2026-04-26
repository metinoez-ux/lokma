const fs = require('fs');
const path = '/Users/metinoz/Developer/LOKMA_MASTER/admin_portal/src/app/[locale]/admin/business/[id]/HardwareTabContent.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Add Info import
if (!content.includes('Info')) {
  content = content.replace(/import\s+{([^}]+)}\s+from\s+["']lucide-react["'];/, "import { $1, Info } from 'lucide-react';");
}

// 2. Add selectedProductDetail state
if (!content.includes('selectedProductDetail')) {
  content = content.replace(
    /const \[selectedImage, setSelectedImage\] = useState<string \| null>\(null\);/,
    "const [selectedImage, setSelectedImage] = useState<string | null>(null);\n  const [selectedProductDetail, setSelectedProductDetail] = useState<any | null>(null);"
  );
}

// 3. Add getDetailedSpecs function
if (!content.includes('getDetailedSpecs')) {
  content = content.replace(
    /const hardwareList: any\[\] = \[/,
    `const getDetailedSpecs = (product: any) => {
    if (product.detailedSpecs) return product.detailedSpecs;
    if (product.category === 'ESL Etiketleri' && product.filters?.size) {
      const size = product.filters.size;
      return {
        productSize: size > 10 ? "272 * 196 * 14mm" : size > 5 ? "139 * 110 * 13mm" : "105 * 88 * 13mm",
        screenSize: \`\${size} inches\`,
        productWeight: size > 10 ? "416g" : size > 5 ? "145g" : "65g",
        enduranceTime: "5 Yıl (Günde 5 güncelleme ile)",
        displayColor: product.filters.colors === 2 ? "Black / White" : product.filters.colors === 3 ? "Black / White / Red" : "Black / White / Red / Yellow",
        resolution: size > 10 ? "960 * 640" : size > 5 ? "648 * 480" : "400 * 300"
      };
    }
    return null;
  };

  const hardwareList: any[] = [`
  );
}

// 4. Modify onClick for images
content = content.replace(
  /onClick=\{\(\) => product\.image \? setSelectedImage\(product\.image\) : null\}/g,
  "onClick={() => product.image ? setSelectedProductDetail(product) : null}"
);

// 5. Add Detailed Product Modal before Image Lightbox Modal
const modalCode = `
      {/* Product Detail Modal */}
      {selectedProductDetail && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 overflow-y-auto py-10" onClick={() => setSelectedProductDetail(null)}>
          <div className="relative bg-card w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row my-auto" onClick={e => e.stopPropagation()}>
            <button 
              className="absolute top-4 right-4 bg-black/10 hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20 text-foreground w-10 h-10 rounded-full flex items-center justify-center transition-colors z-20"
              onClick={() => setSelectedProductDetail(null)}
            >
              ✕
            </button>
            
            {/* Left side: Images */}
            <div className="w-full md:w-1/2 bg-white dark:bg-white/5 flex flex-col p-8 items-center justify-center border-b md:border-b-0 md:border-r border-border/50">
               <img src={selectedImage || selectedProductDetail.image} alt={selectedProductDetail.name} className="max-w-full max-h-[350px] object-contain mb-8" />
               {selectedProductDetail.images && selectedProductDetail.images.length > 0 && (
                 <div className="flex gap-3 overflow-x-auto p-2 max-w-full hide-scrollbar">
                    {[selectedProductDetail.image, ...selectedProductDetail.images].map((img: string, i: number) => (
                      <div key={i} onClick={() => setSelectedImage(img)} className="w-16 h-16 border border-border/50 rounded-lg cursor-pointer shrink-0 overflow-hidden hover:border-primary transition-colors bg-white">
                         <img src={img} className="w-full h-full object-cover" />
                      </div>
                    ))}
                 </div>
               )}
            </div>

            {/* Right side: Specs */}
            <div className="w-full md:w-1/2 p-8 flex flex-col max-h-[80vh] overflow-y-auto custom-scrollbar">
              <div className="text-sm text-primary font-medium mb-2">{selectedProductDetail.category}</div>
              <h2 className="text-3xl font-bold text-foreground mb-4">{selectedProductDetail.name}</h2>
              <p className="text-muted-foreground mb-8 text-base">{selectedProductDetail.description}</p>
              
              {/* Detailed Specs Table */}
              {getDetailedSpecs(selectedProductDetail) && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold text-foreground mb-4 border-b border-border/50 pb-2 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Teknik Detaylar
                  </h3>
                  <div className="space-y-3">
                    {Object.entries(getDetailedSpecs(selectedProductDetail)).map(([k, v]) => (
                      <div key={k} className="flex justify-between border-b border-border/30 pb-2 text-sm">
                        <span className="text-muted-foreground capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                        <span className="font-medium text-foreground text-right max-w-[60%]">{v as string}</span>
                      </div>
                    ))}
                  </div>
                  
                  {getDetailedSpecs(selectedProductDetail)?.enduranceTime && (
                    <div className="mt-6 p-4 bg-primary/10 border border-primary/20 rounded-xl text-sm text-foreground flex items-start gap-3">
                      <Info className="w-6 h-6 shrink-0 text-primary mt-0.5" />
                      <div>
                        <strong className="block mb-1 text-primary">Pil Ömrü (Dayanıklılık) Hakkında Bilgi</strong>
                        ESL cihazlarında pil bittiğinde cihaz <strong>çöp olmaz veya kullanılamaz hale gelmez.</strong> Bu cihazlar standart Lityum Düğme Pil (genelde CR2450) kullanır. Pil ömrü dolduğunda kapağı açılarak pil çok düşük bir maliyetle saniyeler içinde yenilenir ve cihaz 5 yıl daha sorunsuz çalışmaya devam eder.
                      </div>
                    </div>
                  )}
                </div>
              )}
              
              <div className="mt-auto pt-6 border-t border-border/50 flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center">
                 <div>
                   <div className="text-3xl font-bold text-foreground">€{selectedProductDetail.price.toFixed(2)}</div>
                   {selectedProductDetail.rentPrice > 0 && <div className="text-sm text-muted-foreground">veya €{selectedProductDetail.rentPrice.toFixed(2)} / ay kiralama</div>}
                 </div>
                 <button className="bg-primary text-primary-foreground px-8 py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20" onClick={() => { 
                   setSelectedProductDetail(null);
                   // Optionally scroll to order section
                 }}>
                   Siparişe Dön
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}
`;

if (!content.includes('Product Detail Modal')) {
  content = content.replace('{/* Image Lightbox Modal */}', modalCode + '\n      {/* Image Lightbox Modal */}');
}

fs.writeFileSync(path, content);
