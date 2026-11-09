export function informationPanel(label, paragraphs = []) {
  const details = document.createElement('details');
  details.className = 'ui-info';
  const summary = document.createElement('summary');
  summary.textContent = 'i';
  summary.dataset.layerAction = 'info';
  summary.setAttribute('aria-label', label);
  summary.title = label;
  details.append(summary);
  for (const text of paragraphs) {
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    details.append(paragraph);
  }
  return details;
}
