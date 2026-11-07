
/* ================= SITE SEARCH ================= */
(function(){
  var $=function(s){return document.querySelector(s)};
  var gs=$('#gs'),inp=$('#gsInput'),note=$('#gsNote');
  function open(){gs.classList.add('show');gs.setAttribute('aria-hidden','false');setTimeout(function(){inp.focus()},120)}
  function close(){gs.classList.remove('show');gs.setAttribute('aria-hidden','true')}
  function run(q){
    q=(q||'').trim();if(!q){inp.focus();return}
    if(!window.veySearch)return;
    close();window.veySearch.run(q);
    var a=document.querySelector('.nav a[data-view="shop"]');if(a)a.click();   // opens the Shop page
    inp.value='';note.innerHTML='';
  }
  $('#openSearch').addEventListener('click',open);
  $('#gsX').addEventListener('click',close);
  gs.addEventListener('click',function(e){if(e.target===gs)close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&gs.classList.contains('show'))close()});
  // typing + Enter / keyboard "Search" key / Search button all do the same thing
  var last=0;
  function submit(){var t=Date.now();if(t-last<400)return;last=t;run(inp.value)}
  $('#gsForm').addEventListener('submit',function(e){e.preventDefault();submit()});
  $('#gsGo').addEventListener('click',function(e){e.preventDefault();submit()});
  inp.addEventListener('keydown',function(e){if(e.key==='Enter'||e.keyCode===13){e.preventDefault();submit()}});
  inp.addEventListener('keyup',function(e){if(e.key==='Enter'||e.keyCode===13){e.preventDefault();submit()}});
  $('#gsChips').addEventListener('click',function(e){var b=e.target.closest('[data-q]');if(b)run(b.dataset.q)});
  inp.addEventListener('input',function(){
    var q=inp.value.trim();if(!q||!window.veySearch){note.innerHTML='';return}
    var n=window.veySearch.count(q);
    note.innerHTML=n?'<b>'+n+'</b> '+(n===1?'look':'looks')+' found &mdash; press Enter to view in the Shop':'No looks found yet. Try &ldquo;lehenga&rdquo; or &ldquo;anarkali&rdquo;.';
  });
})();
