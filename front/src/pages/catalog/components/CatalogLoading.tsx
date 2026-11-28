export const CatalogLoading = () => (
  <div className='catalog-loading' role='status'>
    <p>Загружаем предложения…</p>
    <div className='catalog-grid' aria-hidden='true'>
      <span />
      <span />
      <span />
    </div>
  </div>
);
