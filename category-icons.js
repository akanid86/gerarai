'use strict';
/* Approved GERARAI pixel family. Presentation only; category data and map logic stay independent. */
(function(root){
const glyphs={
  "food": "<rect fill=\"#966b36\" x=\"3\" y=\"2\" width=\"1\" height=\"3\"/><rect fill=\"#966b36\" x=\"7\" y=\"1\" width=\"1\" height=\"3\"/><rect fill=\"#966b36\" x=\"11\" y=\"2\" width=\"1\" height=\"3\"/><path d=\"M2 7H14V10H12V12H10V13H6V12H4V10H2Z\"/><rect x=\"5\" y=\"14\" width=\"6\" height=\"1\"/>",
  "cafe": "<rect fill=\"#966b36\" x=\"4\" y=\"1\" width=\"1\" height=\"3\"/><rect fill=\"#966b36\" x=\"8\" y=\"1\" width=\"1\" height=\"3\"/><path d=\"M2 6H11V7H14V12H10V13H4V12H2ZM11 9V10H12V9Z\"/><rect x=\"2\" y=\"14\" width=\"10\" height=\"1\"/>",
  "nature": "<path d=\"M7 1H9V3H10V5H12V7H10V8H13V10H11V11H14V13H9V15H7V13H2V11H5V10H3V8H6V7H4V5H6V3H7Z\"/><rect x=\"7\" y=\"13\" width=\"2\" height=\"2\" fill=\"#815431\"/>",
  "animal": "<rect x=\"2\" y=\"3\" width=\"2\" height=\"3\"/><rect x=\"5\" y=\"1\" width=\"2\" height=\"3\"/><rect x=\"9\" y=\"1\" width=\"2\" height=\"3\"/><rect x=\"12\" y=\"3\" width=\"2\" height=\"3\"/><path d=\"M6 6H10V8H12V10H13V13H11V14H9V13H7V14H5V13H3V10H4V8H6Z\"/>",
  "music_event": "<path d=\"M6 2H14V11H12V12H9V10H10V9H12V5H8V13H6V14H3V12H4V11H6Z\"/>",
  "life": "<path d=\"M2 4H4V3H6V4H8V6H9V4H11V3H13V4H15V9H13V11H11V13H9V15H7V13H5V11H3V9H1V5H2Z\"/>",
  "strange": "<path d=\"M4 2H12V3H14V7H12V9H9V11H7V8H9V7H11V4H5V6H3V3H4Z\"/><rect x=\"7\" y=\"13\" width=\"2\" height=\"2\"/>",
  "toilet": "<rect x=\"2\" y=\"2\" width=\"4\" height=\"6\"/><rect x=\"2\" y=\"1\" width=\"4\" height=\"1\"/><path d=\"M2 9H14V11H12V13H9V14H12V15H5V13H6V12H4V11H2Z\"/>",
  "shower": "<path d=\"M7 1H13V2H15V7H13V3H8V5H10V7H2V5H6V2H7Z\"/><rect fill=\"#367fab\" x=\"2\" y=\"9\" width=\"2\" height=\"2\"/><rect fill=\"#367fab\" x=\"6\" y=\"9\" width=\"2\" height=\"2\"/><rect fill=\"#367fab\" x=\"10\" y=\"9\" width=\"2\" height=\"2\"/><rect fill=\"#367fab\" x=\"3\" y=\"13\" width=\"2\" height=\"2\"/><rect fill=\"#367fab\" x=\"7\" y=\"13\" width=\"2\" height=\"2\"/>",
  "other": "<rect x=\"2\" y=\"7\" width=\"3\" height=\"3\"/><rect x=\"7\" y=\"7\" width=\"3\" height=\"3\"/><rect x=\"12\" y=\"7\" width=\"3\" height=\"3\"/>",
  "flood": "<path d=\"M1 4H3V3H6V4H8V5H10V4H12V3H15V6H13V7H10V8H7V7H5V6H3V7H1Z\"/><path d=\"M1 10H3V9H6V10H8V11H10V10H12V9H15V12H13V13H10V14H7V13H5V12H3V13H1Z\"/>",
  "road_passable": "<path d=\"M4 3H12V5H13V7H15V12H13V14H11V12H5V14H3V12H1V7H3V5H4ZM5 5V7H11V5ZM3 9V10H5V9ZM11 9V10H13V9Z\"/>",
  "road_blocked": "<path d=\"M5 1H11V3H13V5H15V11H13V13H11V15H5V13H3V11H1V5H3V3H5ZM4 7V9H12V7Z\"/>",
  "shelter": "<path d=\"M7 1H9V3H11V5H13V7H15V9H13V15H9V10H7V15H3V9H1V7H3V5H5V3H7Z\"/><path fill=\"#aa6138\" d=\"M7 1H9V3H11V5H13V7H15V8H1V7H3V5H5V3H7Z\"/>",
  "food_water": "<rect x=\"10\" y=\"1\" width=\"3\" height=\"2\"/><path d=\"M10 4H13V6H14V14H9V6H10Z\"/><path fill=\"#93632b\" d=\"M2 8H6V9H7V14H1V9H2ZM3 9V11H4V9Z\"/>",
  "medical": "<rect x=\"6\" y=\"2\" width=\"4\" height=\"12\"/><rect x=\"2\" y=\"6\" width=\"12\" height=\"4\"/>",
  "power_charging": "<path d=\"M8 1H13V3H11V5H9V7H13V9H11V11H9V13H7V15H5V11H7V9H3V7H5V5H6V3H8Z\"/>",
  "help_request": "<path d=\"M7 1H9V3H11V6H13V10H15V14H1V10H3V6H5V3H7ZM7 5V10H9V5ZM7 11V13H9V11Z\"/>",
  "recovered": "<path d=\"M13 2H15V6H13V8H11V10H9V12H7V14H5V12H3V10H1V7H4V9H6V10H7V8H9V6H11V4H13Z\"/>",
  "stay": "<rect x=\"1\" y=\"4\" width=\"2\" height=\"11\"/><rect x=\"13\" y=\"7\" width=\"2\" height=\"8\"/><rect x=\"3\" y=\"10\" width=\"10\" height=\"3\"/><rect x=\"4\" y=\"6\" width=\"3\" height=\"3\"/><rect x=\"8\" y=\"7\" width=\"5\" height=\"2\"/>",
  "culture": "<path d=\"M7 1H9V3H11V4H14V6H12V7H15V9H12V11H14V13H10V10H6V13H2V11H4V9H1V7H4V6H2V4H5V3H7Z\"/><rect x=\"3\" y=\"14\" width=\"10\" height=\"1\"/>",
  "travel": "<path d=\"M5 1H11V2H13V12H11V13H13V15H10V14H6V15H3V13H5V12H3V2H5ZM5 4V8H11V4ZM5 10V11H7V10ZM9 10V11H11V10Z\"/>",
  "all": "<path d=\"M7 1H9V5H11V7H15V9H11V11H9V15H7V11H5V9H1V7H5V5H7Z\"/>",
  "health": "<rect x=\"6\" y=\"2\" width=\"4\" height=\"12\"/><rect x=\"2\" y=\"6\" width=\"12\" height=\"4\"/>"
};
const palette={
  "food": "#a44e28",
  "cafe": "#765035",
  "nature": "#34704b",
  "animal": "#93632b",
  "music_event": "#77519e",
  "life": "#b44769",
  "strange": "#5267a6",
  "toilet": "#356d99",
  "shower": "#217987",
  "other": "#626d65",
  "flood": "#2b709b",
  "road_passable": "#4e6384",
  "road_blocked": "#b5473c",
  "shelter": "#a35c30",
  "food_water": "#2b709b",
  "medical": "#34704b",
  "power_charging": "#987018",
  "help_request": "#a45c20",
  "recovered": "#34704b",
  "stay": "#367585",
  "culture": "#805495",
  "travel": "#5267a6",
  "all": "#8b6a27",
  "health": "#34704b"
};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(code,fallback='◆'){
  if(!Object.prototype.hasOwnProperty.call(glyphs,code))return escape(fallback);
  return '<svg class="category-icon" data-category-icon="'+code+'" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="24" height="24" fill="currentColor" fill-rule="evenodd" shape-rendering="crispEdges" aria-hidden="true" focusable="false" style="color:'+palette[code]+'">'+glyphs[code]+'</svg>';
}
root.GerarAICategoryIcons=Object.freeze({render});
})(typeof window!=='undefined'?window:globalThis);
