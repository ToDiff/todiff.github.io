(function () {
  'use strict';

  // CSV fields may contain quoted commas, newlines, and escaped quotes.
  function parseCSV(text) {
    var rows = [];
    var row = [];
    var field = '';
    var quoted = false;

    function finishRow() {
      row.push(field);
      if (row.some(function (value) { return value.trim() !== ''; })) rows.push(row);
      row = [];
      field = '';
    }

    text = text.replace(/^\uFEFF/, '');
    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (char === ',' && !quoted) {
        row.push(field);
        field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && text[i + 1] === '\n') i++;
        finishRow();
      } else {
        field += char;
      }
    }
    if (quoted) throw new Error('Unclosed quoted CSV field.');
    if (field !== '' || row.length) finishRow();
    return rows;
  }

  async function loadBugReports() {
    var message = document.getElementById('loading-message');
    try {
      var response = await fetch('static/bug/rpib-study.csv', { cache: 'no-cache' });
      if (!response.ok) throw new Error('CSV request failed: ' + response.status);
      var rows = parseCSV(await response.text());
      if (rows.length < 2) throw new Error('The bug dataset is empty.');

      var headers = rows.shift().map(function (header) {
        var label = header.replace(/\s+/g, ' ').trim();
        return label.toLowerCase() === 'id' ? 'ID' : label;
      });
      var idIndex = headers.indexOf('ID');
      var linkIndex = headers.findIndex(function (header) { return header.toLowerCase() === 'link'; });
      if (idIndex < 0 || linkIndex < 0) throw new Error('Missing ID or link column.');

      var columns = headers.map(function (label, index) {
        return { label: label === 'commit（第几个commit）' ? 'Commit ID' : label, index: index };
      }).filter(function (column) {
        return column.label && !['link', 'collected by'].includes(column.label.toLowerCase());
      });

      var bugs = rows.filter(function (row) {
        return row[idIndex] && row[idIndex].trim();
      }).map(function (values) {
        return {
          values: values,
          searchText: columns.map(function (column) { return values[column.index] || ''; }).join(' ').toLowerCase()
        };
      });

      var format = new Intl.NumberFormat('en-US');
      function countValues(name, splitValues) {
        var index = headers.indexOf(name);
        var values = new Set();
        bugs.forEach(function (bug) {
          var value = bug.values[index] || '';
          (splitValues ? value.split(',') : [value]).forEach(function (item) {
            if (item.trim()) values.add(item.trim());
          });
        });
        return format.format(values.size);
      }

      document.getElementById('bug-count').textContent = format.format(bugs.length);
      document.getElementById('repository-count').textContent = countValues('Repository', false);
      document.getElementById('protocol-count').textContent = countValues('Affected Protocol', true);
      document.getElementById('bug-type-count').textContent = countValues('RQ1: Bug Type', false);

      var headingRow = document.getElementById('bug-report-headings');
      columns.forEach(function (column) {
        var cell = document.createElement('th');
        cell.scope = 'col';
        cell.textContent = column.label;
        headingRow.appendChild(cell);
      });

      var tbody = document.getElementById('bug-report-table');
      var search = document.getElementById('bug-search');
      var resultCount = document.getElementById('result-count');

      function renderBugs() {
        var query = search.value.trim().toLowerCase();
        var matches = bugs.filter(function (bug) { return bug.searchText.includes(query); });
        var fragment = document.createDocumentFragment();
        matches.forEach(function (bug) {
          var row = document.createElement('tr');
          columns.forEach(function (column) {
            var cell = document.createElement('td');
            var value = (bug.values[column.index] || '').trim();
            var href = (bug.values[linkIndex] || '').trim();
            if (column.index === idIndex && /^https?:\/\//i.test(href)) {
              var link = document.createElement('a');
              link.href = href;
              link.target = '_blank';
              link.rel = 'noopener noreferrer';
              link.textContent = value;
              cell.appendChild(link);
            } else {
              cell.textContent = value;
            }
            row.appendChild(cell);
          });
          fragment.appendChild(row);
        });
        if (!matches.length) {
          var emptyRow = document.createElement('tr');
          var emptyCell = document.createElement('td');
          emptyCell.colSpan = columns.length;
          emptyCell.textContent = 'No matching bugs.';
          emptyRow.appendChild(emptyCell);
          fragment.appendChild(emptyRow);
        }
        tbody.replaceChildren(fragment);
        resultCount.textContent = format.format(matches.length) + ' of ' + format.format(bugs.length) + ' bugs';
      }

      renderBugs();
      search.addEventListener('input', renderBugs);
      message.hidden = true;
      document.getElementById('bug-gallery').hidden = false;
    } catch (error) {
      console.error('Failed to load RPIB bugs:', error);
      message.textContent = 'Unable to load bug reports. Please refresh the page to try again.';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadBugReports);
  } else {
    loadBugReports();
  }
})();
