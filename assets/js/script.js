(function () {
  var yearNode = document.getElementById('year');
  if (yearNode) {
    yearNode.textContent = new Date().getFullYear();
  }

  var toggle = document.querySelector('.menu-toggle');
  var nav = document.getElementById('primary-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var isOpen = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  var zoomableImages = Array.prototype.slice.call(document.querySelectorAll('.image-crop img, .product-image img, .thumb-grid img'));
  if (!zoomableImages.length) {
    return;
  }

  var overlay = document.createElement('div');
  overlay.className = 'image-lightbox';
  overlay.setAttribute('hidden', 'hidden');
  overlay.innerHTML = ''
    + '<button class="image-lightbox-close" type="button" aria-label="Close image preview">×</button>'
    + '<div class="image-lightbox-stage">'
    + '  <img class="image-lightbox-img" alt="Expanded image preview">'
    + '</div>';
  document.body.appendChild(overlay);

  var overlayImg = overlay.querySelector('.image-lightbox-img');
  var closeBtn = overlay.querySelector('.image-lightbox-close');

  function closeLightbox() {
    overlay.setAttribute('hidden', 'hidden');
    document.body.classList.remove('lightbox-open');
    overlayImg.removeAttribute('src');
    overlayImg.removeAttribute('alt');
  }

  function openLightbox(img) {
    overlayImg.src = img.currentSrc || img.src;
    overlayImg.alt = img.alt || 'Expanded image preview';
    overlay.removeAttribute('hidden');
    document.body.classList.add('lightbox-open');
  }

  zoomableImages.forEach(function (img) {
    img.classList.add('zoomable-image');
    img.setAttribute('tabindex', '0');
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', (img.alt || 'Image') + ' - click to enlarge');

    img.addEventListener('click', function () {
      openLightbox(img);
    });

    img.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLightbox(img);
      }
    });
  });

  closeBtn.addEventListener('click', closeLightbox);
  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && !overlay.hasAttribute('hidden')) {
      closeLightbox();
    }
  });
})();
