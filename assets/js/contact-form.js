(function () {
  var form = document.querySelector('.inquiry-form');
  if (!form) return;

  var statusBox = document.getElementById('formStatus');
  var submitButton = form.querySelector('button[type="submit"]');
  var productField = form.querySelector('[name="product"]');

  function setStatus(message, type) {
    if (!statusBox) return;
    statusBox.hidden = false;
    statusBox.className = 'form-status ' + (type || 'info');
    statusBox.textContent = message;
  }

  function appendExtraFields(payload) {
    var labels = {
      intended_use: 'Intended Use',
      required_form: 'Required Form',
      packaging_preference: 'Packaging Preference',
      need_sample: 'Need Sample',
      need_documents: 'Need Documents'
    };

    var extraLines = Object.keys(labels).map(function (key) {
      var value = String(payload[key] || '').trim();
      if (!value) return '';
      return labels[key] + ': ' + value;
    }).filter(Boolean);

    if (!extraLines.length) return payload.message;

    return [payload.message, '', '--- Inquiry Details ---'].concat(extraLines).join('\n');
  }

  var productFromQuery = new URLSearchParams(window.location.search).get('product');
  if (productFromQuery && productField) {
    productField.value = productFromQuery;
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    var formData = new FormData(form);
    var payload = Object.fromEntries(formData.entries());

    if (!payload.name || !payload.email || !payload.product || !payload.message) {
      setStatus('Please fill in name, email, product, and message before submitting.', 'error');
      return;
    }

    payload.message = appendExtraFields(payload);
    delete payload.intended_use;
    delete payload.required_form;
    delete payload.packaging_preference;
    delete payload.need_sample;
    delete payload.need_documents;

    submitButton.disabled = true;
    submitButton.textContent = 'Submitting...';
    setStatus('Sending your inquiry...', 'info');

    try {
      var response = await fetch('/api/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      var result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Submission failed. Please try again later or contact us by email: xinlelikang0318@163.com');
      }

      form.reset();
      if (productFromQuery && productField) {
        productField.value = productFromQuery;
      }
      setStatus('Thank you for your inquiry. We will contact you as soon as possible.', 'success');
    } catch (error) {
      setStatus(error.message || 'Submission failed. Please try again later or contact us by email: xinlelikang0318@163.com', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Submit Inquiry';
    }
  });
})();