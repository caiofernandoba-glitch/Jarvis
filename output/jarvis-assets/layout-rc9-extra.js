/* RC9 — somente composição visual. Não altera armazenamento, cálculos, IA ou eventos. */
(function () {
  'use strict';
  var CSS_HREF = new URL('jarvis-assets/layout-rc9-extra.css', document.baseURI).href;

  function injectFinanceCSS(doc) {
    if (!doc || doc.getElementById('jarvis-layout-rc9-extra-css')) return;
    var link = doc.createElement('link');
    link.id = 'jarvis-layout-rc9-extra-css';
    link.rel = 'stylesheet';
    link.href = CSS_HREF;
    doc.head.appendChild(link);
  }

  function arrangeFinance(doc) {
    if (!doc) return;
    var chart = doc.getElementById('finance-live-dashboard');
    var monthDetail = doc.querySelector('.month-detail-layout');
    if (chart && monthDetail && chart.previousElementSibling !== monthDetail) {
      monthDetail.insertAdjacentElement('afterend', chart);
    }
    var editor=doc.querySelector('.gringotts-editor'),wrap=doc.querySelector('main.wrap'),foot=wrap&&wrap.querySelector(':scope > .foot');
    if(editor&&wrap){if(foot){if(editor.nextElementSibling!==foot)wrap.insertBefore(editor,foot);}else if(wrap.lastElementChild!==editor)wrap.appendChild(editor);}
    var confirm=doc.getElementById('gringotts-confirm');
    if(editor&&confirm&&!editor.querySelector('.gringotts-confirm-actions')){var cancel=confirm.nextElementSibling,actions=doc.createElement('div');actions.className='gringotts-confirm-actions';confirm.before(actions);actions.appendChild(confirm);if(cancel&&cancel.tagName==='BUTTON')actions.appendChild(cancel);}
  }

  function setupFinance() {
    var frame = document.getElementById('gringottsFrame');
    if (!frame || frame.dataset.rc9LayoutReady === 'true') return;
    frame.dataset.rc9LayoutReady = 'true';
    frame.addEventListener('load', function () {
      try {
        var doc = frame.contentDocument;
        injectFinanceCSS(doc);
        arrangeFinance(doc);
        /* The editor is created during the iframe bootstrap; this covers delayed renders. */
        new MutationObserver(function () { arrangeFinance(doc); })
          .observe(doc.body, { childList: true, subtree: true });
      } catch (_) {
        /* Same-origin access is expected for the packaged local iframe. */
      }
    });
  }

  function setupLayout() {
    var home=document.getElementById('home'),food=document.getElementById('homeFoodToday'),health=document.getElementById('rc8HealthPanel'),head=home&&home.querySelector(':scope > header');
    var stage=home&&home.querySelector(':scope > .stage');
    if(head&&stage)head.insertAdjacentElement('afterend',stage);
    if(head&&food){(stage||head).insertAdjacentElement('afterend',food);if(health)food.insertAdjacentElement('afterend',health);}
    var legacy=document.getElementById('jarvisDashboardV22');if(legacy){legacy.hidden=false;legacy.removeAttribute('aria-hidden');if(health)health.insertAdjacentElement('afterend',legacy);}
    var menu=document.querySelector('#jarvisSidebar [data-jarvis-route="nutrition"]');if(menu){menu.hidden=true;menu.setAttribute('aria-hidden','true');}
    var footer=document.querySelector('.jarvis-sidebar-footer');if(footer)footer.innerHTML='Versão 2.3 RC15<br>Registros no aparelho. Fechamento só por você.';
    setupFinance();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setupLayout);
  else setupLayout();
}());
