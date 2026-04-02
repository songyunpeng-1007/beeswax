(function () {
  var pageRoot = document.querySelector('[data-product-page]');
  if (!pageRoot) return;

  var slug = new URLSearchParams(window.location.search).get('slug') || 'yellow-beeswax';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderList(items) {
    return (items || []).map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('');
  }

  function renderFaq(items) {
    if (!items || !items.length) {
      return '<article class="faq-item"><h3>Can I send an inquiry from this page?</h3><p>Yes. Please use the inquiry button and include your quantity, destination market, and any packing or sample requirement.</p></article>';
    }

    return items.map(function (item) {
      return '<article class="faq-item">'
        + '<h3>' + escapeHtml(item.question) + '</h3>'
        + '<p>' + escapeHtml(item.answer) + '</p>'
        + '</article>';
    }).join('');
  }

  function renderRelatedProducts(items) {
    if (!items || !items.length) {
      return '<article class="card"><h3>Explore More Products</h3><p>Please return to the products page to compare available beeswax options.</p><p><a class="text-link" href="/products">View Products</a></p></article>';
    }

    return items.map(function (item) {
      return '<article class="card related-product-card">'
        + '<h3>' + escapeHtml(item.name) + '</h3>'
        + '<p>' + escapeHtml(item.summary || 'Compare this option if you want a different form, appearance, or handling direction for your project.') + '</p>'
        + '<p><a class="text-link" href="/product?slug=' + encodeURIComponent(item.slug) + '">View Product</a></p>'
        + '</article>';
    }).join('');
  }

  function updateMeta(product) {
    document.title = product.name + ' Supplier | Hebei Cera Rica';
    var meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', product.shortDescription + ' Request packing, sample, and quotation discussion from Hebei Cera Rica.');
  }

  function setQuoteLinks(productName) {
    var href = '/contact?product=' + encodeURIComponent(productName);
    ['quoteButton', 'quoteButtonBottom', 'quoteButtonFinal'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.setAttribute('href', href);
    });
  }

  function renderProduct(product) {
    updateMeta(product);
    setQuoteLinks(product.name);

    document.getElementById('productName').textContent = product.name;
    document.getElementById('productLead').textContent = product.shortDescription;
    document.getElementById('productOverview').innerHTML = (product.longDescription || []).map(function (paragraph) {
      return '<p>' + escapeHtml(paragraph) + '</p>';
    }).join('');
    document.getElementById('detailIntroTitle').textContent = 'Why Buyers Ask About ' + product.name;

    var gallery = product.gallery || [];
    var mainImage = gallery[0] || { src: product.coverImage, alt: product.name };
    document.getElementById('mainImage').src = mainImage.src;
    document.getElementById('mainImage').alt = mainImage.alt || product.name;

    document.getElementById('thumbGrid').innerHTML = gallery.map(function (image) {
      return '<div class="image-crop"><img src="' + escapeHtml(image.src) + '" alt="' + escapeHtml(image.alt || product.name) + '" loading="lazy"></div>';
    }).join('');

    document.getElementById('specTableBody').innerHTML = Object.keys(product.specs || {}).map(function (key) {
      return '<tr><th>' + escapeHtml(key) + '</th><td>' + escapeHtml(product.specs[key]) + '</td></tr>';
    }).join('');

    document.getElementById('applicationsList').innerHTML = renderList(product.applications);
    document.getElementById('packagingList').innerHTML = renderList(product.packaging);
    document.getElementById('documentsList').innerHTML = renderList(product.documents);
    document.getElementById('quoteTipsList').innerHTML = renderList(product.quoteTips || []);
    document.getElementById('productFaqList').innerHTML = renderFaq(product.faq || []);
    document.getElementById('relatedProductsList').innerHTML = renderRelatedProducts(product.relatedProducts || []);
    document.getElementById('highlightApplications').textContent = (product.applications || []).slice(0, 3).join(', ') || 'Please contact us for application guidance.';
    document.getElementById('landingPageNote').textContent = 'If ' + product.name + ' looks relevant to your project, send your quantity, destination market, preferred form, and any sample or document request for faster follow-up.';
  }

  function renderMissing() {
    document.getElementById('productName').textContent = 'Product Not Found';
    document.getElementById('productLead').textContent = 'The requested product is not available in this version yet.';
    document.getElementById('productOverview').innerHTML = '<p>Please return to the products page and choose one of the available beeswax items.</p>';
    document.getElementById('thumbGrid').innerHTML = '';
    document.getElementById('specTableBody').innerHTML = '';
    document.getElementById('applicationsList').innerHTML = '<li>Please contact us for product guidance.</li>';
    document.getElementById('packagingList').innerHTML = '<li>Packaging details available upon request.</li>';
    document.getElementById('documentsList').innerHTML = '<li>Document support can be discussed during inquiry.</li>';
    document.getElementById('quoteTipsList').innerHTML = '<li>Share product need and intended use.</li><li>Include quantity and destination market.</li><li>Mention packing or sample request.</li>';
    document.getElementById('productFaqList').innerHTML = renderFaq([]);
    document.getElementById('relatedProductsList').innerHTML = renderRelatedProducts([]);
    document.getElementById('highlightApplications').textContent = 'Please contact us for application guidance.';
    document.getElementById('landingPageNote').textContent = 'Please return to the products page and send an inquiry if you need help choosing a suitable beeswax product.';
  }

  fetch('content/products.json')
    .then(function (response) {
      if (!response.ok) throw new Error('Failed to load product data.');
      return response.json();
    })
    .then(function (products) {
      var product = (products || []).find(function (item) {
        return item.slug === slug;
      });
      if (!product) {
        renderMissing();
        return;
      }
      renderProduct(product);
    })
    .catch(function () {
      renderMissing();
    });
})();
