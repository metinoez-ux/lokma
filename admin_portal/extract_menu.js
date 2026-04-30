const fs = require('fs');
const file = 'src/app/[locale]/admin/kermes/[id]/page.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

const startIdx = 4567; // line 4568 is index 4567
const endIdx = 5957;   // line 5958 is index 5957

const extracted = lines.slice(startIdx, endIdx);

const newFileContent = `import React from 'react';
import { useTranslations } from 'next-intl';

export default function KermesMenuTab(props: any) {
  const {
    t, locale, kermesId, products, setProducts, categories, productsByCategory,
    selectedCategory, setSelectedCategory, showAddModal, setShowAddModal,
    modalView, setModalView, editProduct, setEditProduct, editProductTab, setEditProductTab,
    editBeforeAdd, setEditBeforeAdd, customProduct, setCustomProduct,
    saving, setSaving, searchQuery, setSearchQuery, handleDayStart,
    showCategoryModal, setShowCategoryModal, loadCategories, getCategoryEmoji,
    getLocalizedText, handleToggleAvailability, handleDeleteProduct, handleToggleStockEnabled,
    handleStockAdjust, handleStockSet, handleMarkSoldOut, handleSetInitialStock, handleLoadSalesHistory,
    filteredCatalog, filteredMaster, handleSelectFromCatalog, handleSelectFromMaster,
    handleCreateCustom, handleConfirmAdd, isUploadingProductImage, setIsUploadingProductImage,
    compressLokmaImage, storage, ref, uploadBytes, getDownloadURL,
    kermesSectionDefs, PrepZoneSelector, CategoryManagementModal, showToast,
    loadingMaster, masterProducts, loadMasterProducts
  } = props;

  return (
    <>
${extracted.join('\n')}
    </>
  );
}
`;

fs.writeFileSync('src/app/[locale]/admin/kermes/[id]/KermesMenuTab.tsx', newFileContent);

lines.splice(startIdx, endIdx - startIdx, '  {activeTab === "menu" && <KermesMenuTab ' + 
  't={t} locale={locale} kermesId={kermesId} products={products} setProducts={setProducts} ' +
  'categories={categories} productsByCategory={productsByCategory} selectedCategory={selectedCategory} ' +
  'setSelectedCategory={setSelectedCategory} showAddModal={showAddModal} setShowAddModal={setShowAddModal} ' +
  'modalView={modalView} setModalView={setModalView} editProduct={editProduct} setEditProduct={setEditProduct} ' +
  'editProductTab={editProductTab} setEditProductTab={setEditProductTab} editBeforeAdd={editBeforeAdd} ' +
  'setEditBeforeAdd={setEditBeforeAdd} customProduct={customProduct} setCustomProduct={setCustomProduct} ' +
  'saving={saving} setSaving={setSaving} searchQuery={searchQuery} setSearchQuery={setSearchQuery} ' +
  'handleDayStart={handleDayStart} showCategoryModal={showCategoryModal} setShowCategoryModal={setShowCategoryModal} ' +
  'loadCategories={loadCategories} getCategoryEmoji={getCategoryEmoji} getLocalizedText={getLocalizedText} ' +
  'handleToggleAvailability={handleToggleAvailability} handleDeleteProduct={handleDeleteProduct} ' +
  'handleToggleStockEnabled={handleToggleStockEnabled} handleStockAdjust={handleStockAdjust} ' +
  'handleStockSet={handleStockSet} handleMarkSoldOut={handleMarkSoldOut} handleSetInitialStock={handleSetInitialStock} ' +
  'handleLoadSalesHistory={handleLoadSalesHistory} filteredCatalog={filteredCatalog} filteredMaster={filteredMaster} ' +
  'handleSelectFromCatalog={handleSelectFromCatalog} handleSelectFromMaster={handleSelectFromMaster} ' +
  'handleCreateCustom={handleCreateCustom} handleConfirmAdd={handleConfirmAdd} ' +
  'isUploadingProductImage={isUploadingProductImage} setIsUploadingProductImage={setIsUploadingProductImage} ' +
  'compressLokmaImage={compressLokmaImage} storage={storage} ref={ref} uploadBytes={uploadBytes} ' +
  'getDownloadURL={getDownloadURL} kermesSectionDefs={kermesSectionDefs} PrepZoneSelector={PrepZoneSelector} ' +
  'CategoryManagementModal={CategoryManagementModal} showToast={showToast} ' +
  'loadingMaster={loadingMaster} masterProducts={masterProducts} loadMasterProducts={loadMasterProducts} ' +
  '/>}'
);

const finalContent = lines.join('\n');
fs.writeFileSync(file, finalContent);
console.log('Extraction complete');
