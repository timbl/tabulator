//Display RDF information in tabular form using HTML DOM
// 
// CVS Id: tabulate.js,v 1.345 2006/01/12 14:00:56 timbl Exp $
//
// SVN ID: $Id: tabulate.js 3119 2007-06-07 03:46:41Z jambo $
//
// See Help.html, About.html, tb.html

//tabulate.js is now the main driving class behind the web version of the Tabulator.

LanguagePreference = "en"    // @@ How to set this from the browser? From cookie?

var kb = new RDFIndexedFormula()  // This uses indexing and smushing
var sf = new SourceFetcher(kb) // This handles resource retrieval

kb.sf = sf // Make knowledge base aware of source fetcher to allow sameAs to propagate a fetch

kb.register('dc', "http://purl.org/dc/elements/1.1/")
kb.register('rdf', "http://www.w3.org/1999/02/22-rdf-syntax-ns#")
kb.register('rdfs', "http://www.w3.org/2000/01/rdf-schema#")
kb.register('owl', "http://www.w3.org/2002/07/owl#")


function AJAR_handleNewTerm(kb, p, requestedBy) {
    //tdebug("entering AJAR_handleNewTerm w/ kb, p=" + p + ", requestedBy=" + requestedBy);
    if (p.termType != 'symbol') return;
    var docuri = Util.uri.docpart(p.uri);
    var fixuri;
    if (p.uri.indexOf('#') < 0) { // No hash

	// @@ major hack for dbpedia Categories, which spred indefinitely
	if (string_startswith(p.uri, 'http://dbpedia.org/resource/Category:')) return;  
	if (string_startswith(p.uri, 'http://purl.org/dc/elements/1.1/')
		   || string_startswith(p.uri, 'http://purl.org/dc/terms/')) {
            fixuri = "http://dublincore.org/2005/06/13/dcq";
	    //dc fetched multiple times
        } else if (string_startswith(p.uri, 'http://xmlns.com/wot/0.1/')) {
            fixuri = "http://xmlns.com/wot/0.1/index.rdf";
        } else if (string_startswith(p.uri, 'http://web.resource.org/cc/')) {
//            twarn("creative commons links to html instead of rdf. doesn't seem to content-negotiate.");
            fixuri = "http://web.resource.org/cc/schema.rdf";
        }
    }
    if (fixuri) {
	docuri = fixuri
    }
    if (sf.getState(kb.sym(docuri)) != 'unrequested') return;
    
    if (fixuri) {   // only give warning once: else happens too often
        twarn("Assuming server still broken, faking redirect of <" + p.uri +
	    "> to <" + docuri + ">")	
    }
    sf.requestURI(docuri, requestedBy);
} //AJAR_handleNewTerm


kb.predicateCallback = AJAR_handleNewTerm
kb.typeCallback = AJAR_handleNewTerm

selection = []  // Array of statements which have been selected

// For offline working, you might want to map URIs to local copies.
var SiteMap = []
SiteMap[ "http://www.w3.org/" ] = "http://localhost/www.w3.org/"  // Salt to taste

// Icons. Must be able to change for platform-consistency,
// color blindness, etc.



Icon = {}
Icon.src= []

Icon.src.icon_expand = 'icons/tbl-expand-trans.png';
Icon.src.icon_more = 'icons/tbl-more-trans.png'; // looks just like expand, diff semantics
// Icon.src.icon_expand = 'icons/clean/Icon.src.Icon.src.icon_expand.png';
Icon.src.icon_collapse = 'icons/tbl-collapse.png';
Icon.src.icon_shrink = 'icons/tbl-shrink.png';  // shrink list back up
Icon.src.icon_rows = 'icons/tbl-rows.png';
// Icon.src.Icon.src.icon_columns = 'icons/tbl-columns.png';
Icon.src.icon_unrequested = 'icons/16dot-blue.gif';
// Icon.src.Icon.src.icon_parse = 'icons/18x18-white.gif';
Icon.src.icon_fetched = 'icons/16dot-green.gif';
Icon.src.icon_failed = 'icons/16dot-red.gif';
Icon.src.icon_requested = 'icons/16dot-yellow.gif';
// Icon.src.icon_maximize = 'icons/clean/Icon.src.Icon.src.icon_con_max.png';
Icon.src.icon_visit = 'icons/document.png';
// actions for sources;
Icon.src.icon_retract = 'icons/retract.gif';
Icon.src.icon_refresh = 'icons/refresh.gif';
Icon.src.icon_optoff = 'icons/optional_off.PNG';
Icon.src.icon_opton = 'icons/optional_on.PNG';
Icon.src.icon_map = 'icons/compassrose.png';
Icon.src.icon_retracted = Icon.src.icon_unrequested 
Icon.src.icon_retracted = Icon.src.icon_unrequested;
Icon.src.icon_time = 'icons/Wclocksmall.png';
Icon.src.icon_remove_node = 'icons/tbl-x-small.png'
Icon.tooltips = [];
Icon.OutlinerIcon= function (src, width, alt, tooltip, filter)
{
	this.src=src;
	this.alt=alt;
	this.width=width;
	this.tooltip=tooltip;
	this.filter=filter;
       //filter: RDFStatement,('subj'|'pred'|'obj')->boolean, inverse->boolean (whether the statement is an inverse).
       //Filter on whether to show this icon for a term; optional property.
       //If filter is not passed, this icon will never AUTOMATICALLY be shown.
       //You can show it with termWidget.addIcon
	return this;
}
Icon.termWidgets = {}
Icon.termWidgets.optOn = new Icon.OutlinerIcon(Icon.src.icon_opton,20,'opt on','Make this branch of your query mandatory.');
Icon.termWidgets.optOff = new Icon.OutlinerIcon(Icon.src.icon_optoff,20,'opt off','Make this branch of your query optional.');
Icon.termWidgets.map = new Icon.OutlinerIcon(Icon.src.icon_map,30,'mappable','You can view this field in the map view.', 
function (st, type, inverse) { return (type=='pred' && !inverse&& st.predicate.sameTerm(foaf('based_near'))) });
function calendarable(st, type, inverse){
    var obj = (inverse) ? st.subject : st.object;
    var calType = findCalType(st.predicate.toString());
    //@TODO. right now we can't tell apart "is component of" from "is component"
    if (obj!=undefined){
	obj.cal = calType;
    }
    if (!inverse){
       if (calType==null || calType=='summary'){
           return false;
       } else if (calType=='dateThing'){
           return (st.object.termType=="literal");
           // if literal, might be date info...
       } else {
           return true;
       }
    } else {
       return false;
    }
};
Icon.termWidgets.time = new Icon.OutlinerIcon(Icon.src.icon_time,20,'time',
'You can view this field in the calendar or timeline view',
					      calendarable);

Icon.tooltips[Icon.src.icon_remove_node]='Remove this.'
Icon.tooltips[Icon.src.icon_expand]='View details.'
Icon.tooltips[Icon.src.icon_collapse] = 'Hide details.'
Icon.tooltips[Icon.src.icon_collapse] = 'Hide list.'
Icon.tooltips[Icon.src.icon_rows] = 'Make a table of data like this'
Icon.tooltips[Icon.src.icon_unrequested] = 'Fetch this resource.'
Icon.tooltips[Icon.src.icon_fetched] = 'This was fetched successfully.'
Icon.tooltips[Icon.src.icon_failed] = 'Failed to load. Click to retry.'
Icon.tooltips[Icon.src.icon_requested] = 'Being fetched. Please wait...'
Icon.tooltips[Icon.src.icon_visit] = 'View the HTML content of this page within tabulator.'
Icon.tooltips[Icon.src.icon_retract] = 'Remove this source and all its data from tabulator.'
Icon.tooltips[Icon.src.icon_refresh] = 'Refresh this source and reload its triples.'

// Special knowledge of properties
tabont = Namespace("http://dig.csail.mit.edu/2005/ajar/ajaw#")
foaf = Namespace("http://xmlns.com/foaf/0.1/")
rdf = Namespace("http://www.w3.org/1999/02/22-rdf-syntax-ns#")
RDFS = Namespace("http://www.w3.org/2000/01/rdf-schema#")
OWL = Namespace("http://www.w3.org/2002/07/owl#")
dc = Namespace("http://purl.org/dc/elements/1.1/")
rss = Namespace("http://purl.org/rss/1.0/")
xsd = Namespace("http://www.w3.org/TR/2004/REC-xmlschema-2-20041028/#dt-")
contact = Namespace("http://www.w3.org/2000/10/swap/pim/contact#")
mo = Namespace("http://purl.org/ontology/mo/")

// labels  -- maybe, extend this with a propertyAction
labelPriority = []
labelPriority[foaf('name').uri] = 10
labelPriority[dc('title').uri] = 8
labelPriority[rss('title').uri] = 6   // = dc:title?
labelPriority[contact('fullName').uri] = 4
labelPriority['http://www.w3.org/2001/04/roadmap/org#name'] = 4
labelPriority[foaf('nick').uri] = 3
labelPriority[RDFS('label').uri] = 2

// Predicates used for inner workings. Under the hood
internals = []
internals['http://dig.csail.mit.edu/2005/ajar/ajaw/ont#request'] = 1;
internals['http://dig.csail.mit.edu/2005/ajar/ajaw/ont#requestedBy'] = 1;
internals['http://dig.csail.mit.edu/2005/ajar/ajaw/ont#source'] = 1;
internals['http://dig.csail.mit.edu/2005/ajar/ajaw/ont#session'] = 1;
internals['http://www.w3.org/2006/link#uri'] = 1;
internals['http://www.w3.org/2006/link#Document'] = 1;
internals['http://www.w3.org/2000/01/rdf-schema#seeAlso'] = 1;

var outline=new Outline(document);

/** returns true if str starts with pref, case sensitive, space sensitive **/
function string_startswith(str, pref) { // missing library routines
    return (str.slice(0, pref.length) == pref);
}

function StatusWidget() {
    this.ele = document.getElementById('TabulatorStatusWidget')
    this.pend = 0
    this.errors = {}
    var sw = this

    this.recv = function (uri) {
	sw.pend++
	sw.update()
	return true
    }

    this.quit = function (uri) {
	sw.pend--
	sw.update()
	return true
    }

    this.update = function () {
        if(sw.pend==0)
          sw.ele.style.display="none";
        else
          sw.ele.style.display="inline";
	sw.ele.textContent = "Sources pending: "+sw.pend
	return true
    }

    sf.addCallback('request',this.recv)
    sf.addCallback('fail',this.quit)
    sf.addCallback('done',this.quit)
}

// ******************  Source Widget
// Replaces what used to be in sources.js

function SourceWidget() {
    this.ele = document.getElementById('sources')    
    this.sources = {}
    var sw = this

    this.addStatusUpdateCallbacks = function (term, node) {
	var cb = function (uri, r) {
	    if (!node) { return false }
	    if (!uri) { return true }
	    var udoc = kb.sym(Util.uri.docpart(uri))
	    if (udoc.sameTerm(term)) {
		var req = kb.any(udoc, kb.sym('tab', 'request')) // @@ what if > 1?
		var lstat = kb.the(req, kb.sym('tab','status'))
		if (typeof lstat.elements[lstat.elements.length-1]
		    != "undefined") {
		    node.textContent = lstat.elements[lstat.elements.length-1]
		}
		return false
	    } else {
		return true  // call me again
	    }
	}

	sf.addCallback('recv',cb)
	sf.addCallback('load',cb)
	sf.addCallback('fail',cb)
	sf.addCallback('done',cb)	
    }

    this.addSource = function (uri, r) {
	var udoc = kb.sym(Util.uri.docpart(uri))
	if (!sw.sources[udoc.uri]) {
	    var row = document.createElement('tr')
	    sw.sources[udoc.uri] = row		// was true - tbl
	    var iconCell = document.createElement('td')
	    var src = document.createElement('td')
	    var status = document.createElement('td')
	
	    var rbtn = outline.appendAccessIcon(iconCell, udoc)
	    var xbtn = AJARImage(Icon.src.icon_remove_node, 'remove');
	    rbtn.style.marginRight = "0.8em"
	    rbtn.onclick = function () {
		sf.refresh(udoc)
	    }
	    xbtn.onclick = function () {
		sf.retract(udoc)
		sw.ele.removeChild(row)
	    }
	    iconCell.appendChild(xbtn)

	    src.style.color = "blue"
	    src.style.cursor = "default"
	    src.textContent = udoc.uri
	    src.onclick = function (e) {
		GotoSubject(udoc, true)
	    }

	    sw.addStatusUpdateCallbacks(udoc,status)
	    sf.addCallback('refresh',function (u, r) {
			       if (!status) { return false }
			       if (!uri) { return true }
			       var udoc2 = kb.sym(Util.uri.docpart(uri))
			       if (udoc2.sameTerm(udoc)) {
				   sw.addStatusUpdateCallbacks(udoc,status)
			       }
			       return true
			   })

	    row.appendChild(iconCell)
	    row.appendChild(src)
	    row.appendChild(status)
	    
	    sw.ele.appendChild(row)
	}
	return true
    }

    sf.addCallback('request',this.addSource)
    sf.addCallback('retract',function (u) {
		       u.uri && delete sw.sources[u.uri]
		       return true
		   })
		   
    this.highlight = function(u, on) {
	if (!u) return;
	this.sources[u.uri].setAttribute('class', on ? 'sourceHighlight' : '')
    }
}

////////////////////////////////////////////////////////
//
//
//                    VIEWS
//
//
////////////////////////////////////////////////////////

var views = {
    properties                          : [],
    defaults                                : [],
    classes                                 : []
}; //views

/** add a property view function **/
function views_addPropertyView(property, pviewfunc, isDefault) {
    if (!views.properties[property]) 
        views.properties[property] = [];
    views.properties[property].push(pviewfunc);
    if(isDefault) //will override an existing default!
        views.defaults[property] = pviewfunc;
} //addPropertyView

//view that applies to items that are objects of certain properties.
//views_addPropertyView(property, viewjsfile, default?)
views_addPropertyView(foaf('depiction').uri, VIEWAS_image, true);
views_addPropertyView(foaf('img').uri, VIEWAS_image, true);
views_addPropertyView(foaf('thumbnail').uri, VIEWAS_image, true);
views_addPropertyView(foaf('logo').uri, VIEWAS_image, true);
views_addPropertyView(mo('image').uri, VIEWAS_image, true);
//views_addPropertyView(foaf('aimChatID').uri, VIEWAS_aim_IMme, true);
views_addPropertyView(foaf('mbox').uri, VIEWAS_mbox, true);
//views_addPropertyView(foaf('based_near').uri, VIEWAS_map, true);
views_addPropertyView(foaf('birthday').uri, VIEWAS_cal, true);

/** some builtin simple views **/
function VIEWAS_boring_default(obj) {
    //log.debug("entered VIEWAS_boring_default...");
    var rep; //representation in html

    if (obj.termType == 'literal')
    {
        rep = document.createTextNode(obj.value);
    } else if (obj.termType == 'symbol' || obj.termType == 'bnode') {
        rep = document.createElement('span');
        rep.setAttribute('about', obj.toNT());
        outline.appendAccessIcon(rep, obj);
        rep.appendChild(document.createTextNode(label(obj)));
        if ((obj.termType == 'symbol') &&
            (obj.uri.indexOf("#") < 0) &&
            (Util.uri.protocol(obj.uri)=='http'
	     || Util.uri.protocol(obj.uri)=='https')) {
	    // a web page @@ file, ftp;
                var linkButton = document.createElement('input');
                linkButton.type='image';
                linkButton.src='icons/document.png';
                linkButton.alt='Open in new window';
                linkButton.onclick= function () {
                    return window.open(''+obj.uri,
				       ''+obj.uri,
				       'width=500,height=500,resizable=1,scrollbars=1')
                }
                linkButton.title='View in a new window';
                rep.appendChild(linkButton);
        }
    } else if (obj.termType=='collection'){
	// obj.elements is an array of the elements in the collection
	rep = document.createElement('table');
	rep.setAttribute('about', obj.toNT());
/* Not sure which looks best -- with or without. I think without

	var tr = rep.appendChild(document.createElement('tr'));
	tr.appendChild(document.createTextNode(
		obj.elements.length ? '(' + obj.elements.length+')' : '(none)'));
*/
	for (var i=0; i<obj.elements.length; i++){
	    var elt = obj.elements[i];
	    var row = rep.appendChild(document.createElement('tr'));
	    var numcell = row.appendChild(document.createElement('td'));
	    numcell.setAttribute('about', obj.toNT());
	    numcell.innerHTML = (i+1) + ')';
	    row.appendChild(outline_objectTD(elt));
	}
    } else {
        log.error("unknown term type: " + obj.termType);
        rep = document.createTextNode("[unknownTermType:" + obj.termType +"]");
    } //boring defaults.
    log.debug("contents: "+rep.innerHTML);
    return rep;
}  //boring_default!
function VIEWAS_image(obj) {
    return AJARImage(obj.uri, label(obj), label(obj));
}

function VIEWAS_mbox(obj) {
    var anchor = document.createElement('a');
    // previous implementation assumed email address was Literal. fixed.
    
    // FOAF mboxs must NOT be literals -- must be mailto: URIs.
    
    var address = (obj.termType=='symbol') ? obj.uri : obj.value; // this way for now
    if (!address) return VIEWAS_boring_default(obj)
    var index = address.indexOf('mailto:');
    address = (index >= 0) ? address.slice(index + 7) : address;
    anchor.setAttribute('href', 'mailto:'+address);
    anchor.appendChild(document.createTextNode(address));
    return anchor;
}

/* need to make unique calendar containers and names
 * YAHOO.namespace(namespace) returns the namespace specified 
 * and creates it if it doesn't exist
 * function 'uni' creates a unique namespace for a calendar and 
 * returns number ending
 * ex: uni('cal') may create namespace YAHOO.cal1 and return 1
 *
 * YAHOO.namespace('foo.bar') makes YAHOO.foo.bar defined as an object,
 * which can then have properties
 */

function uni(prefix){
    var n = counter();
    var name = prefix + n;
    YAHOO.namespace(name);
    return n;
}

// counter for calendar ids, 
counter = function(){
	var n = 0;
	return function(){
		n+=1;
		return n;
	}
}() // *note* those ending parens! I'm using function scope

var renderHoliday = function(workingDate, cell) { 
	YAHOO.util.Dom.addClass(cell, "holiday");
} 


/* toggles whether element is displayed
 * if elt.getAttribute('display') returns null, 
 * it will be assigned 'block'
 */
function toggle(eltname){
	var elt = document.getElementById(eltname);
	elt.style.display = (elt.style.display=='none')?'block':'none'
}

/* Example of calendar Id: cal1
 * 42 cells in one calendar. from top left counting, each table cell has
 * ID: YAHOO.cal1_cell0 ... YAHOO.cal.1_cell41
 * name: YAHOO.cal1__2006_3_2 for anchor inside calendar cell 
 * of date 3/02/2006
 * 
 */	
function VIEWAS_cal(obj) {
	prefix = 'cal';
	var cal = prefix + uni(prefix);

	var containerId = cal + 'Container';
	var table = document.createElement('table');
	
	
	// create link to hide/show calendar
	var a = document.createElement('a');
	// a.appendChild(document.createTextNode('[toggle]'))
	a.innerHTML="<small>mm-dd: " + obj.value + "[toggle]</small>";
	//a.setAttribute('href',":toggle('"+containerId+"')");
	a.onclick = function(){toggle(containerId)};
	table.appendChild(a);

	var dateArray = obj.value.split("-");
	var m = dateArray[0];
	var d = dateArray[1];
	var yr = (dateArray.length>2)?dateArray[2]:(new Date()).getFullYear();

	// hack: calendar will be appended to divCal at first, but will
	// be moved to new location
	document.getElementById('divCal').appendChild(table);
	var div = table.appendChild(document.createElement('DIV'));
	div.setAttribute('id', containerId);
	// default hide calendar
	div.style.display = 'none';
	div.setAttribute('tag','calendar');
	YAHOO[cal] = new YAHOO.widget.Calendar("YAHOO." + cal, containerId, m+"/"+yr);

	YAHOO[cal].addRenderer(m+"/"+d, renderHoliday); 

	YAHOO[cal].render();
	// document.childNodes.removeChild(table);
	return table;
}


// test writing something to calendar cell


function VIEWAS_aim_IMme(obj) {
    var anchor = document.createElement('a');
    anchor.setAttribute('href', "aim:goim?screenname=" + obj.value + "&message=hello");
    anchor.setAttribute('title', "IM me!");
    anchor.appendChild(document.createTextNode(obj.value));
    return anchor;
} //aim_IMme

function createTabURI() {
    document.getElementById('UserURI').value=
      document.URL+"?uri="+document.getElementById('UserURI').value;
}

///////////////////////////////////////////////////
//
//
//
//        simplify event handling
//
//
//
///////////////////////////////////////////////////
/** add event to elm of type evType executing fn **/
function addEvent(elm, evType, fn, useCapture) {
    if (elm.addEventListener) {
        elm.addEventListener(evType, fn, useCapture);
        return true;
    }
    else if (elm.attachEvent) {
        var r = elm.attachEvent('on' + evType, fn);
        return r;
    }
    else {
        elm['on' + evType] = fn;
    }
} //addEvent

/** add event on page load **/
function addLoadEvent(func) {
    var oldonload = window.onload;
    if (typeof window.onload != 'function') {
        window.onload = func;
    }
    else {
        window.onload = function() {
            oldonload();
            func();
        }
    }
} //addLoadEvent

function test() {
    tmsg("DEPENDENCIES: ");
    for (var d in sources.depends) tmsg("d=" + d + ", sources.depends[d]=" + sources.depends[d]);
    tmsg("CALLBACKS: ");
    for (var c in sources.callbacks) tmsg("c=" + c + ", sources.callbacks[c]=" + sources.callbacks[c]);
} //test
//end;

/** nicked from http://www.safalra.com/programming/javascript/getdata.html 
 *  initializes a global GET_DATA array **/
var GET_DATA; //global
function initialiseGetData(){
    GET_DATA=new Array();
    var getDataString=new String(window.location);
    var questionMarkLocation=getDataString.search(/\?/);
    if (questionMarkLocation!=-1){
        getDataString=getDataString.substr(questionMarkLocation+1);
        var getDataArray=getDataString.split(/&/g);
        for (var i=0;i<getDataArray.length;i++){
            var nameValuePair=getDataArray[i].split(/=/);
            GET_DATA[decodeURIComponent(nameValuePair[0])]=decodeURIComponent(nameValuePair[1]);
        }
    }
}

/** if the get ?uri= is set, begin with that; if ?sparql is set, empty the 
starting points and start with the specified query; otherwise, display the suggested
 * starting points **/
function AJAR_initialisePage()
{
    statusWidget = new StatusWidget()
    sourceWidget = new SourceWidget()
    initialiseGetData();
    var browser = document.getElementById('browser');
    var q
    if (GET_DATA['query']) {
        emptyNode(browser);
    	var txt = GET_DATA['query'];
    	txt = txt.replace(/\+/g,"%20")
    	txt = window.decodeURIComponent(txt)
    	q = SPARQLToQuery(txt)
    	if (GET_DATA['sname']) q.name=GET_DATA['sname']
	qs.addQuery(q);
    }
    if (GET_DATA['uri']) {
        //clear browser
        emptyNode(browser);
		document.getElementById('UserURI').value = GET_DATA['uri'];
        GotoURIAndOpen(GET_DATA['uri']);
    }
    else
    {
    	var links = { 'http://dig.csail.mit.edu/2005/ajar/ajaw/data#Tabulator':'The tabulator project',
    			  'http://dig.csail.mit.edu/data#DIG':'Decentralised Information Group' };
    	for (q in links)
    	{
    		/*var tr = document.createElement('tr')
    		var td = document.createElement('td')
    		td.setAttribute('about',q)
    		browser.appendChild(tr)
    		tr.appendChild(td)
    		td.appendChild(AJARImage(icon_expand,'expand'))
    		td.appendChild(document.createTextNode(links[q]))*/
    		kb.add(kb.sym(q),kb.sym('dc',"title"),kb.literal(links[q]));
    		outline.GotoURIinit(q)
    	}
    } //go to an initial uri
} //initialize page


///and at the end
//addLoadEvent(function() { sources_request_new(tabulator_ns('')) });
//addLoadEvent(function () { sources_request_new(kb.sym('http://www.w3.org/People/Connolly/#me')); });
addLoadEvent(AJAR_initialisePage)