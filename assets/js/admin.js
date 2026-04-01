(function () {
  var tableBody = document.getElementById('inquiryTableBody');
  if (!tableBody) return;

  var searchInput = document.getElementById('searchInput');
  var statusFilter = document.getElementById('statusFilter');
  var refreshButton = document.getElementById('refreshButton');
  var logoutButton = document.getElementById('logoutButton');
  var adminMessage = document.getElementById('adminMessage');
  var detailPanel = document.getElementById('detailPanel');
  var detailEmpty = document.getElementById('detailEmpty');
  var detailList = document.getElementById('detailList');
  var detailStatus = document.getElementById('detailStatus');
  var detailNote = document.getElementById('detailNote');
  var saveDetailButton = document.getElementById('saveDetailButton');

  var selectedId = null;
  var inquiries = [];

  function showMessage(message, type) {
    adminMessage.hidden = false;
    adminMessage.className = 'admin-message ' + (type || 'info');
    adminMessage.textContent = message;
  }

  function clearMessage() {
    adminMessage.hidden = true;
    adminMessage.textContent = '';
    adminMessage.className = 'admin-message';
  }

  function formatStatus(status) {
    return ({ new: 'New', contacted: 'Contacted', follow_up: 'Follow Up', closed: 'Closed', invalid: 'Invalid' })[status] || status;
  }

  function formatDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return value || '';
    return date.toLocaleString();
  }

  function renderSummary(records) {
    document.getElementById('totalCount').textContent = records.length;
    document.getElementById('newCount').textContent = records.filter(function (item) { return item.status === 'new'; }).length;
    document.getElementById('followUpCount').textContent = records.filter(function (item) { return item.status === 'follow_up' || item.status === 'contacted'; }).length;
    document.getElementById('closedCount').textContent = records.filter(function (item) { return item.status === 'closed'; }).length;
  }

  function getFilteredRecords() {
    var keyword = (searchInput.value || '').trim().toLowerCase();
    var status = statusFilter.value;

    return inquiries.filter(function (item) {
      var matchesStatus = !status || item.status === status;
      var haystack = [item.name, item.company, item.email, item.country, item.product, item.message, item.note]
        .join(' ')
        .toLowerCase();
      var matchesKeyword = !keyword || haystack.indexOf(keyword) !== -1;
      return matchesStatus && matchesKeyword;
    });
  }

  function renderTable() {
    var records = getFilteredRecords();
    renderSummary(inquiries);

    if (!records.length) {
      tableBody.innerHTML = '<tr><td colspan="7" class="muted">No inquiry records found.</td></tr>';
      return;
    }

    tableBody.innerHTML = records.map(function (item) {
      return '<tr data-id="' + item.id + '">' +
        '<td>' + formatDate(item.createdAt) + '</td>' +
        '<td>' + (item.name || '-') + '</td>' +
        '<td>' + (item.company || '-') + '</td>' +
        '<td>' + (item.country || '-') + '</td>' +
        '<td>' + (item.product || '-') + '</td>' +
        '<td><span class="status-pill status-' + item.status + '">' + formatStatus(item.status) + '</span></td>' +
        '<td><button class="btn btn-small admin-row-button" type="button" data-select-id="' + item.id + '">View</button></td>' +
        '</tr>';
    }).join('');
  }

  function renderDetail(item) {
    if (!item) {
      selectedId = null;
      detailPanel.hidden = true;
      detailEmpty.hidden = false;
      return;
    }

    selectedId = item.id;
    detailEmpty.hidden = true;
    detailPanel.hidden = false;
    detailStatus.value = item.status || 'new';
    detailNote.value = item.note || '';

    detailList.innerHTML = [
      ['Name', item.name],
      ['Company', item.company],
      ['Email', item.email],
      ['Phone / Contact', item.contact_method],
      ['Country', item.country],
      ['Product', item.product],
      ['Estimated Quantity', item.quantity],
      ['Submitted At', formatDate(item.createdAt)],
      ['Message', item.message],
      ['Source', item.sourcePage || 'contact.html'],
      ['IP', item.ip || '-']
    ].map(function (entry) {
      return '<div><dt>' + entry[0] + '</dt><dd>' + (entry[1] || '-') + '</dd></div>';
    }).join('');
  }

  async function loadInquiries() {
    clearMessage();
    try {
      var response = await fetch('/api/admin/inquiries', { credentials: 'include' });
      if (response.status === 401) {
        window.location.href = '/api/admin/login';
        return;
      }
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to load inquiries.');
      inquiries = result.items || [];
      renderTable();
      if (selectedId) {
        renderDetail(inquiries.find(function (item) { return item.id === selectedId; }));
      }
    } catch (error) {
      showMessage(error.message || 'Failed to load inquiries.', 'error');
      tableBody.innerHTML = '<tr><td colspan="7" class="muted">Unable to load inquiry records.</td></tr>';
    }
  }

  async function saveDetail() {
    if (!selectedId) return;
    saveDetailButton.disabled = true;
    try {
      var response = await fetch('/api/admin/inquiries/' + selectedId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: detailStatus.value, note: detailNote.value })
      });
      var result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to update inquiry.');
      showMessage('Inquiry updated.', 'success');
      await loadInquiries();
      renderDetail(inquiries.find(function (item) { return item.id === selectedId; }));
    } catch (error) {
      showMessage(error.message || 'Failed to update inquiry.', 'error');
    } finally {
      saveDetailButton.disabled = false;
    }
  }

  tableBody.addEventListener('click', function (event) {
    var button = event.target.closest('[data-select-id]');
    if (!button) return;
    var id = button.getAttribute('data-select-id');
    renderDetail(inquiries.find(function (item) { return item.id === id; }));
  });

  searchInput.addEventListener('input', renderTable);
  statusFilter.addEventListener('change', renderTable);
  refreshButton.addEventListener('click', loadInquiries);
  saveDetailButton.addEventListener('click', saveDetail);
  logoutButton.addEventListener('click', async function () {
    await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/api/admin/login';
  });

  loadInquiries();
})();