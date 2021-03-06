/**
* Few General purpose utility functions used in the panes
* oshani@csail.mit.edu 
*
* Includes form-oriented widgets
* 
* sign-in sign-up widgets are in signin.js
*
*  Note... For pointers to posssible text-editing code, see
*  http://stackoverflow.com/questions/6756407/what-contenteditable-editors
*/


// paneUtils = {};
tabulator.panes.utils = {};
tabulator.panes.field = {}; // Form field functions by URI of field type.

// This is used to canonicalize an array
tabulator.panes.utils.unique = function(a){
   var r = new Array();
   o:for(var i = 0, n = a.length; i < n; i++){
      for(var x = 0, y = r.length; x < y; x++){
         if(r[x]==a[i]) continue o;
      }
      r[r.length] = a[i];
   }
   return r;
}

//To figure out the log URI from the full URI used to invoke the reasoner
tabulator.panes.utils.extractLogURI = function(fullURI){
    var logPos = fullURI.search(/logFile=/);
    var rulPos = fullURI.search(/&rulesFile=/);
    return fullURI.substring(logPos+8, rulPos); 			
}

// @@@ This needs to be changed to local timee
tabulator.panes.utils.shortDate = function(str) {
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date
    if (!str) return '???';
    var month = [ 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec' ];
    try {
        var now = new Date();
        var then = new Date(str);
        var nowZ = $rdf.term(now).value;
        var n = now.getTimezoneOffset(); // Minutes
        if (str.slice(0,10) == nowZ.slice(0,10)) return str.slice(11,16);
        if (str.slice(0,4) == nowZ.slice(0,4)) {
            return ( month[parseInt(str.slice(5,7))] + ' ' + parseInt(str.slice(8,10)));
        }
        return str.slice(0,10);
    } catch(e) {
        return 'shortdate:' + e
    }
}


tabulator.panes.utils.formatDateTime = function(date, format) {
    return format.split('{').map(function(s){
        var k = s.split('}')[0];
        var width = {'Milliseconds':3, 'FullYear':4};  
        var d = {'Month': 1};                  
        return s?  ( '000' + (date['get' + k]() + (d[k]|| 0))).slice(-(width[k]||2)) + s.split('}')[1] : '';
    }).join('');
};

tabulator.panes.utils.timestamp = function() {
    return tabulator.panes.utils.formatDateTime(new Date(), '{FullYear}-{Month}-{Date}T{Hours}:{Minutes}:{Seconds}.{Milliseconds}');
}
tabulator.panes.utils.shortTime = function() {
    return tabulator.panes.utils.formatDateTime(new Date(), '{Hours}:{Minutes}:{Seconds}.{Milliseconds}');
}


tabulator.panes.utils.newThing = function(store) {
    var now = new Date();
    // http://www.w3schools.com/jsref/jsref_obj_date.asp
    return $rdf.sym(store.uri + '#' + 'id'+(''+ now.getTime()));
}

/////////////////////////////////////////////////////////////////////////


/*                                  Form Field implementations
**
*/
/*          Group of different fields
**
*/
tabulator.panes.field[tabulator.ns.ui('Form').uri] =
tabulator.panes.field[tabulator.ns.ui('Group').uri] = function(
                                    dom, container, already, subject, form, store, callback) {
    var kb = tabulator.kb;
    var box = dom.createElement('div');
    box.setAttribute('style', 'padding-left: 2em; border: 0.05em solid brown;');  // Indent a group
    var ui = tabulator.ns.ui;
    container.appendChild(box);
    
    // Prevent loops
    var key = subject.toNT() + '|' +  form.toNT() ;
    if (already[key]) { // been there done that
        box.appendChild(dom.createTextNode("Group: see above "+key));
        var plist = [$rdf.st(subject, tabulator.ns.owl('sameAs'), subject)]; // @@ need prev subject
        tabulator.outline.appendPropertyTRs(box, plist);
        return box;
    }
    // box.appendChild(dom.createTextNode("Group: first time, key: "+key));
    already2 = {};
    for (var x in already) already2[x] = 1;
    already2[key] = 1;
    
    var parts = kb.each(form, ui('part'));
    if (!parts) { box.appendChild(tabulator.panes.utils.errorMessageBlock(dom,
                "No parts to form! ")); return dom};
    var p2 = tabulator.panes.utils.sortBySequence(parts);
    var eles = [];
    var original = [];
    for (var i=0; i<p2.length; i++) {
        var field = p2[i];
        var t = tabulator.panes.utils.bottomURI(field); // Field type
        if (t == ui('Options').uri) {
            var dep = kb.any(field, ui('dependingOn'));
            if (dep && kb.any(subject, dep)) original[i] = kb.any(subject, dep).toNT();
        }

        var fn = tabulator.panes.utils.fieldFunction(dom, field);
        
        var itemChanged = function(ok, body) {
            if (ok) {
                for (j=0; j<p2.length; j++) {  // This is really messy.
                    var field = (p2[j])
                    var t = tabulator.panes.utils.bottomURI(field); // Field type
                    if (t == ui('Options').uri) {
                        var dep = kb.any(field, ui('dependingOn'));
 //                       if (dep && kb.any(subject, dep) && (kb.any(subject, dep).toNT() != original[j])) { // changed
                        if (1) { // assume changed
                            var newOne = fn(dom, box, already, subject, field, store, callback);
                            box.removeChild(newOne);
                            box.insertBefore(newOne, eles[j]);
                            box.removeChild(eles[j]);
                            original[j] = kb.any(subject, dep).toNT();
                            eles[j] = newOne;
                        } 
                    }
                }
            }
            callback(ok, body);
        }
        eles.push(fn(dom, box, already2, subject, field, store, itemChanged));
    }
    return box;
}

/*          Options: Select one or more cases
**
*/
tabulator.panes.field[tabulator.ns.ui('Options').uri] = function(
                                    dom, container, already, subject, form, store, callback) {
    var kb = tabulator.kb;
    var box = dom.createElement('div');
    // box.setAttribute('style', 'padding-left: 2em; border: 0.05em dotted purple;');  // Indent Options
    var ui = tabulator.ns.ui;
    container.appendChild(box);
    
    var dependingOn = kb.any(form, ui('dependingOn'));
    if (!dependingOn) dependingOn = tabulator.ns.rdf('type'); // @@ default to type (do we want defaults?)
    var cases = kb.each(form, ui('case'));
    if (!cases) box.appendChild(tabulator.panes.utils.errorMessageBlock(dom,
                "No cases to Options form. "));
    var values;
    if (dependingOn.sameTerm(tabulator.ns.rdf('type'))) {
        values = kb.findTypeURIs(subject);
    } else { 
        var value = kb.any(subject, dependingOn);
        if (value == undefined) { 
            box.appendChild(tabulator.panes.utils.errorMessageBlock(dom,
                "Can't select subform as no value of: " + dependingOn));
        } else {
            values = {};
            values[value.uri] = true;
        }
    }
    // @@ Add box.refresh() to sync fields with values
    for (var i=0; i<cases.length; i++) {
        var c = cases[i];
        var tests = kb.each(c, ui('for')); // There can be multiple 'for'
        for (var j=0; j<tests.length; j++) {
            if (values[tests[j].uri]) {
                var field = kb.the(c, ui('use'));
                if (!field) { box.appendChild(tabulator.panes.utils.errorMessageBlock(dom,
                "No 'use' part for case in form "+form)); return box}
                else tabulator.panes.utils.appendForm(dom, box, already, subject, field, store, callback);
                break;
            }
        } 
    }
    return box;
}

/*          Multiple similar fields (unordered)
**
*/
tabulator.panes.field[tabulator.ns.ui('Multiple').uri] = function(
                                    dom, container, already, subject, form, store, callback) {
    if (!tabulator.sparql) tabulator.sparql = new tabulator.rdf.sparqlUpdate(kb);
    var kb = tabulator.kb;
    var box = dom.createElement('table');
    // We don't indent multiple as it is a sort of a prefix o fthe next field and has contents of one.
    // box.setAttribute('style', 'padding-left: 2em; border: 0.05em solid green;');  // Indent a multiple
    var ui = tabulator.ns.ui;
    var i;
    container.appendChild(box);
    var property = kb.any(form, ui('property'));
    if (!property) { 
        box.appendChild(tabulator.panes.utils.errorMessageBlock(dom,
                "No property to multiple: "+form)); // used for arcs in the data
        return box;
    }
    var min = kb.any(form, ui('min')); // This is the minimum number -- default 0
    min = min ? min.value : 0;
    var max = kb.any(form, ui('max')); // This is the minimum number
    max = max ? max.value : 99999999;

    var element = kb.any(form, ui('part')); // This is the form to use for each one
    if (!element) {
        box.appendChild(tabulator.panes.utils.errorMessageBlock(dom,"No part to multiple: "+form));
        return box;
    }

    var count = 0;
    // box.appendChild(dom.createElement('h3')).textContent = "Fields:".
    var body = box.appendChild(dom.createElement('tr'));
    var tail = box.appendChild(dom.createElement('tr'));
    var img = tail.appendChild(dom.createElement('img'));
    img.setAttribute('src', tabulator.Icon.src.icon_add_triple); // blue plus
    img.title = "(m) Add " + tabulator.Util.label(property);
    
    var addItem = function(e, object) {
        tabulator.log.debug('Multiple add: '+object);
        var num = ++count;
        if (!object) object = tabulator.panes.utils.newThing(store);
        var tr = box.insertBefore(dom.createElement('tr'), tail);
        var itemDone = function(ok, body) {
            if (ok) { // @@@ Check IT hasnt alreday been written in
                if (!kb.holds(subject, property, object)) {
                    var ins = [$rdf.st(subject, property, object, store)]
                    tabulator.sparql.update([], ins, linkDone);
                }
            } else {
                tr.appendChild(tabulator.panes.utils.errorMessageBlock(dom, "Multiple: item failed: "+body));
                callback(ok, body);
            }
        }
        var linkDone = function(uri, ok, body) {
            return callback(ok, body);
        }
        var fn = tabulator.panes.utils.fieldFunction(dom, element);
        // box.appendChild(dom.createTextNode('multiple object: '+object ));
        fn(dom, body, already, object, element, store, itemDone);        
    }
        
    kb.each(subject, property).map(function(obj){addItem(null, obj)});

    for (i = kb.each(subject, property).length; i < min; i++) {
        addItem(); // Add blanks if less than minimum
    }

    img.addEventListener('click', addItem, true);
    return box
}

/*          Text field
**
*/
// For possible date popups see e.g. http://www.dynamicdrive.com/dynamicindex7/jasoncalendar.htm
// or use HTML5: http://www.w3.org/TR/2011/WD-html-markup-20110113/input.date.html
//

tabulator.panes.fieldParams = {};


tabulator.panes.fieldParams[tabulator.ns.ui('ColorField').uri] = {
    'size': 9, };
tabulator.panes.fieldParams[tabulator.ns.ui('ColorField').uri].pattern = 
    /^\s*#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]([0-9a-f][0-9a-f])?\s*$/;

tabulator.panes.fieldParams[tabulator.ns.ui('DateField').uri] = {
    'size': 20, 'type': 'date', 'dt': 'date'};
tabulator.panes.fieldParams[tabulator.ns.ui('DateField').uri].pattern = 
    /^\s*[0-9][0-9][0-9][0-9](-[0-1]?[0-9]-[0-3]?[0-9])?Z?\s*$/;

tabulator.panes.fieldParams[tabulator.ns.ui('DateTimeField').uri] = {
    'size': 20, 'type': 'date', 'dt': 'dateTime'};
tabulator.panes.fieldParams[tabulator.ns.ui('DateTimeField').uri].pattern = 
    /^\s*[0-9][0-9][0-9][0-9](-[0-1]?[0-9]-[0-3]?[0-9])?(T[0-2][0-9]:[0-5][0-9](:[0-5][0-9])?)?Z?\s*$/;

tabulator.panes.fieldParams[tabulator.ns.ui('IntegerField').uri] = {
    'size': 12, 'style': 'text-align: right', 'dt': 'integer' };
tabulator.panes.fieldParams[tabulator.ns.ui('IntegerField').uri].pattern =
     /^\s*-?[0-9]+\s*$/;
     
tabulator.panes.fieldParams[tabulator.ns.ui('DecimalField').uri] = {
    'size': 12 , 'style': 'text-align: right', 'dt': 'decimal' };
tabulator.panes.fieldParams[tabulator.ns.ui('DecimalField').uri].pattern =
    /^\s*-?[0-9]*(\.[0-9]*)?\s*$/;
    
tabulator.panes.fieldParams[tabulator.ns.ui('FloatField').uri] = {
    'size': 12, 'style': 'text-align: right', 'dt': 'float' };
tabulator.panes.fieldParams[tabulator.ns.ui('FloatField').uri].pattern =
    /^\s*-?[0-9]*(\.[0-9]*)?((e|E)-?[0-9]*)?\s*$/; 

tabulator.panes.fieldParams[tabulator.ns.ui('SingleLineTextField').uri] = { };
tabulator.panes.fieldParams[tabulator.ns.ui('TextField').uri] = { };

tabulator.panes.fieldParams[tabulator.ns.ui('PhoneField').uri] = { 'size' :12, 'uriPrefix': 'tel:' };
tabulator.panes.fieldParams[tabulator.ns.ui('PhoneField').uri].pattern =
     /^\s*\+?[ 0-9-]+[0-9]\s*$/;

tabulator.panes.fieldParams[tabulator.ns.ui('EmailField').uri] = { 'size' :20, 'uriPrefix': 'mailto:' };
tabulator.panes.fieldParams[tabulator.ns.ui('EmailField').uri].pattern =
     /^\s*.*@.*\..*\s*$/;  // @@ Get the right regexp here



tabulator.panes.field[tabulator.ns.ui('PhoneField').uri] = 
tabulator.panes.field[tabulator.ns.ui('EmailField').uri] = 
tabulator.panes.field[tabulator.ns.ui('ColorField').uri] = 
tabulator.panes.field[tabulator.ns.ui('DateField').uri] = 
tabulator.panes.field[tabulator.ns.ui('DateTimeField').uri] = 
tabulator.panes.field[tabulator.ns.ui('NumericField').uri] = 
tabulator.panes.field[tabulator.ns.ui('IntegerField').uri] = 
tabulator.panes.field[tabulator.ns.ui('DecimalField').uri] = 
tabulator.panes.field[tabulator.ns.ui('FloatField').uri] = 
tabulator.panes.field[tabulator.ns.ui('TextField').uri] = 
tabulator.panes.field[tabulator.ns.ui('SingleLineTextField').uri] = function(
                                    dom, container, already, subject, form, store, callback) {
    var ui = tabulator.ns.ui;
    var kb = tabulator.kb;

    var box = dom.createElement('tr');
    container.appendChild(box);
    var lhs = dom.createElement('td');
    lhs.setAttribute('class', 'formFieldName')
    lhs.setAttribute('style', '  vertical-align: middle;')
    box.appendChild(lhs);
    var rhs = dom.createElement('td');
    rhs.setAttribute('class', 'formFieldValue')
    box.appendChild(rhs);

    var property = kb.any(form, ui('property'));
    if (!property) { box.appendChild(dom.createTextNode("Error: No property given for text field: "+form)); return box};

    lhs.appendChild(tabulator.panes.utils.fieldLabel(dom, property, form));
    var uri = tabulator.panes.utils.bottomURI(form); 
    var params = tabulator.panes.fieldParams[uri];
    if (params == undefined) params = {}; // non-bottom field types can do this
    var style = params.style? params.style : '';
    // box.appendChild(dom.createTextNode(' uri='+uri+', pattern='+ params.pattern));
    var field = dom.createElement('input');
    rhs.appendChild(field);
    field.setAttribute('type', params.type? params.type : 'text');
    

    var size = kb.any(form, ui('size')); // Form has precedence
    field.setAttribute('size',  size?  ''+size :(params.size? ''+params.size : '20'));
    var maxLength = kb.any(form, ui('maxLength'));
    field.setAttribute('maxLength',maxLength? ''+maxLength :'4096');

    store = tabulator.panes.utils.fieldStore(subject, property, store);

    var obj = kb.any(subject, property);
    if (!obj) {
        obj = kb.any(form, ui('default'));
        if (obj != undefined) kb.add(subject, property, obj, store)
    }
    if (obj != undefined && obj.value != undefined) field.value = obj.value.toString();
    if (obj != undefined && obj.uri != undefined) field.value = obj.uri.split(':')[1];    // @@ URI encoding/decoding

    field.addEventListener("keyup", function(e) {
        if (params.pattern) field.setAttribute('style', style + (
            field.value.match(params.pattern) ?
                                'color: green;' : 'color: red;'));
    }, true);
    field.addEventListener("change", function(e) { // i.e. lose focus with changed data
        if (params.pattern && !field.value.match(params.pattern)) return;
        field.disabled = true; // See if this stops getting two dates from fumbling e.g the chrome datepicker.
        field.setAttribute('style', 'color: gray;'); // pending 
        var ds = kb.statementsMatching(subject, property); // remove any multiple values
        var newObj =  params.uriPrefix ? kb.sym(params.uriPrefix + field.value.replace(/ /g, ''))
                    : kb.literal(field.value, params.dt);
        var is = $rdf.st(subject, property,
                    params.parse? params.parse(field.value) : field.value, store);// @@ Explicitly put the datatype in.
        tabulator.sparql.update(ds, is, function(uri, ok, body) {
            if (ok) {
                field.disabled = false;
                field.setAttribute('style', 'color: black;');
            } else {
                box.appendChild(tabulator.panes.utils.errorMessageBlock(dom, body));
            }
            callback(ok, body);
        })
    }, true);
    return box;
}


/*          Multiline Text field
**
*/

tabulator.panes.field[tabulator.ns.ui('MultiLineTextField').uri] = function(
                                    dom, container, already, subject, form, store, callback) {
    var ui = tabulator.ns.ui;
    var kb = tabulator.kb;
    var property = kb.any(form, ui('property'));
    if (!property) return tabulator.panes.utils.errorMessageBlock(dom,
                "No property to text field: "+form);
    container.appendChild(tabulator.panes.utils.fieldLabel(dom, property, form));
    store = tabulator.panes.utils.fieldStore(subject, property, store);
    var box = tabulator.panes.utils.makeDescription(dom, kb, subject, property, store, callback);
    // box.appendChild(dom.createTextNode('<-@@ subj:'+subject+', prop:'+property));
    container.appendChild(box);
    return box;
}



/*          Boolean field
**
*/

tabulator.panes.field[tabulator.ns.ui('BooleanField').uri] = function(
                                    dom, container, already, subject, form, store, callback) {
    var ui = tabulator.ns.ui;
    var kb = tabulator.kb;
    var property = kb.any(form, ui('property'));
    if (!property) return container.appendChild(tabulator.panes.utils.errorMessageBlock(dom,
                "No property to boolean field: "+form)); 
    var lab = kb.any(form, ui('label'));
    if (!lab) lab = tabulator.Util.label(property, true); // Init capital
    store = tabulator.panes.utils.fieldStore(subject, property, store);
    var state = kb.any(subject, property)
    if (state == undefined) state = false; // @@ sure we want that -- or three-state?
    // tabulator.log.debug('store is '+store);
    var ins = $rdf.st(subject, property, true, store);
    var del = $rdf.st(subject, property, false, store); 
    var box = tabulator.panes.utils.buildCheckboxForm(dom, kb, lab, del, ins, form, store);
    container.appendChild(box);
    return box;
}

/*          Classifier field
**
**  Nested categories
** 
** @@ To do: If a classification changes, then change any dependent Options fields.
*/

tabulator.panes.field[tabulator.ns.ui('Classifier').uri] = function(
                                    dom, container, already, subject, form, store, callback) {
    var kb = tabulator.kb, ui = tabulator.ns.ui, ns = tabulator.ns;
    var category = kb.any(form, ui('category'));
    if (!category) return tabulator.panes.utils.errorMessageBlock(dom,
                "No category for classifier: " + form);
    tabulator.log.debug('Classifier: store='+store);
    var checkOptions = function(ok, body) {
        if (!ok) return callback(ok, body);
        
        /*
        var parent = kb.any(undefined, ui('part'), form);
        if (!parent) return callback(ok, body);
        var kids = kb.each(parent, ui('part')); // @@@@@@@@@ Garbage
        kids = kids.filter(function(k){return kb.any(k, ns.rdf('type'), ui('Options'))})
        if (kids.length) tabulator.log.debug('Yes, found related options: '+kids[0])
        */
        return callback(ok, body);
    };
    var box = tabulator.panes.utils.makeSelectForNestedCategory(dom, kb, subject, category, store, checkOptions);
    container.appendChild(box);
    return box;
}

/*          Choice field
**
**  Not nested.  Generates a link to something from a given class.
**  Optional subform for the thing selected.
**  Alternative implementatons caould be:
** -- pop-up menu (as here)
** -- radio buttons
** -- auto-complete typing
** 
** Todo: Deal with multiple.  Maybe merge with multiple code.
*/

tabulator.panes.field[tabulator.ns.ui('Choice').uri] = function(
                                    dom, container, already, subject, form, store, callback) {
    var ui= tabulator.ns.ui;
    var ns = tabulator.ns;
    var kb = tabulator.kb;
    var box = dom.createElement('tr');
    container.appendChild(box);
    var lhs = dom.createElement('td');
    box.appendChild(lhs);
    var rhs = dom.createElement('td');
    box.appendChild(rhs);
    var property = kb.any(form, ui('property'));
    if (!property) return tabulator.panes.utils.errorMessageBlock(dom, "No property for Choice: "+form);
    lhs.appendChild(tabulator.panes.utils.fieldLabel(dom, property, form));
    var from = kb.any(form, ui('from'));
    if (!from) return tabulator.panes.utils.errorMessageBlock(dom,
                "No 'from' for Choice: "+form);
    var subForm = kb.any(form, ui('use'));  // Optional
    var possible = [];
    var opts = {'multiple': multiple, 'nullLabel': np, 'disambiguate': false };
    possible = kb.each(undefined, ns.rdf('type'), from);
    for (x in kb.findMembersNT(from)) {
        possible.push(kb.fromNT(x));
        // box.appendChild(dom.createTextNode("RDFS: adding "+x));
    }; // Use rdfs
    // tabulator.log.debug("%%% Choice field: possible.length 1 = "+possible.length)
    if (from.sameTerm(ns.rdfs('Class'))) {
        for (var p in tabulator.panes.utils.allClassURIs()) possible.push(kb.sym(p));     
        // tabulator.log.debug("%%% Choice field: possible.length 2 = "+possible.length)
    } else if (from.sameTerm(ns.rdf('Property'))) {
        //if (tabulator.properties == undefined) 
        tabulator.panes.utils.propertyTriage();
        for (var p in tabulator.properties.op) possible.push(kb.fromNT(p));     
        for (var p in tabulator.properties.dp) possible.push(kb.fromNT(p));
        opts.disambiguate = true;     // This is a big class, and the labels won't be enough.
    } else if (from.sameTerm(ns.owl('ObjectProperty'))) {
        //if (tabulator.properties == undefined) 
        tabulator.panes.utils.propertyTriage();
        for (var p in tabulator.properties.op) possible.push(kb.fromNT(p));     
        opts.disambiguate = true;     
    } else if (from.sameTerm(ns.owl('DatatypeProperty'))) {
        //if (tabulator.properties == undefined)
        tabulator.panes.utils.propertyTriage();
        for (var p in tabulator.properties.dp) possible.push(kb.fromNT(p));     
        opts.disambiguate = true;     
    }
    var object = kb.any(subject, property);
    function addSubForm(ok, body) {
        object = kb.any(subject, property);
        tabulator.panes.utils.fieldFunction(dom, subForm)(dom, rhs, already,
                                        object, subForm, store, callback);
    }
    var multiple = false;
    // box.appendChild(dom.createTextNode('Choice: subForm='+subForm))
    var possible2 = tabulator.panes.utils.sortByLabel(possible);
    var np = "--"+ tabulator.Util.label(property)+"-?";
    if (kb.any(form, ui('canMintNew'))) {
        opts['mint'] = "* New *"; // @@ could be better
        opts['subForm'] = subForm;
    }
    var selector = tabulator.panes.utils.makeSelectForOptions(
                dom, kb, subject, property,
                possible2, opts, store, callback);
    rhs.appendChild(selector);
    if (object && subForm) addSubForm(true, "");
    return box;
}


//          Documentation - non-interactive fields
//

tabulator.panes.fieldParams[tabulator.ns.ui('Comment').uri] = {
    'element': 'p',
    'style': 'padding: 0.1em 1.5em; color: brown; white-space: pre-wrap;'};
tabulator.panes.fieldParams[tabulator.ns.ui('Heading').uri] = {
    'element': 'h3', 'style': 'font-size: 110%; color: brown;' };


tabulator.panes.field[tabulator.ns.ui('Comment').uri] =
tabulator.panes.field[tabulator.ns.ui('Heading').uri] = function(
                    dom, container, already, subject, form, store, callback) {
    var ui = tabulator.ns.ui, kb = tabulator.kb;
    var contents = kb.any(form, ui('contents')); 
    if (!contents) contents = "Error: No contents in comment field.";

    var uri = tabulator.panes.utils.bottomURI(form); 
    var params = tabulator.panes.fieldParams[uri];
    if (params == undefined) params = {}; // non-bottom field types can do this
    
    var box = dom.createElement('div');
    container.appendChild(box);
    var p = box.appendChild(dom.createElement(params['element']));
    p.textContent = contents;

    var style = kb.any(form, ui('style')); 
    if (style == undefined) style = params.style? params.style : '';
    if (style) p.setAttribute('style', style)

    return box;
}




///////////////////////////////////////////////////////////////////////////////


// Event Handler for making a tabulator
// Note that native links have consraints in Firefox, they 
// don't work with local files for instance (2011)
//
tabulator.panes.utils.openHrefInOutlineMode = function(e) {
    e.preventDefault();
    e.stopPropagation();
    var target = tabulator.Util.getTarget(e);
    var uri = target.getAttribute('href');
    if (!uri) dump("No href found \n")
    // subject term, expand, pane, solo, referrer
    // dump('click on link to:' +uri+'\n')
    tabulator.outline.GotoSubject(tabulator.kb.sym(uri), true, undefined, true, undefined);
}





// We make a URI in the annotation store out of the URI of the thing to be annotated.
//
// @@ Todo: make it a personal preference.
//
tabulator.panes.utils.defaultAnnotationStore = function(subject) {
    if (subject.uri == undefined) return undefined;
    var s = subject.uri;
    if (s.slice(0,7) != 'http://') return undefined;
    s = s.slice(7);   // Remove 
    var hash = s.indexOf("#");
    if (hash >=0) s = s.slice(0, hash); // Strip trailing
    else {
        var slash = s.lastIndexOf("/");
        if (slash < 0) return undefined;
        s = s.slice(0,slash);
    }
    return tabulator.kb.sym('http://tabulator.org/wiki/annnotation/' + s );
}


tabulator.panes.utils.fieldStore = function(subject, predicate, def) {
    var sts = tabulator.kb.statementsMatching(subject, predicate);
    if (sts.length == 0) return def;  // can used default as no data yet
    if (sts.length > 0 && sts[0].why.uri && tabulator.sparql.editable(sts[0].why.uri, tabulator.kb))
        return tabulator.kb.sym(sts[0].why.uri);
    return null;  // Can't edit
}

tabulator.panes.utils.allClassURIs = function() {
    var set = {};
    tabulator.kb.statementsMatching(undefined, tabulator.ns.rdf('type'), undefined)
        .map(function(st){if (st.object.uri) set[st.object.uri] = true });
    tabulator.kb.statementsMatching(undefined, tabulator.ns.rdfs('subClassOf'), undefined)
        .map(function(st){
            if (st.object.uri) set[st.object.uri] = true ;
            if (st.subject.uri) set[st.subject.uri] = true });
    tabulator.kb.each(undefined, tabulator.ns.rdf('type'),tabulator.ns.rdfs('Class'))
        .map(function(c){if (c.uri) set[c.uri] = true});
    return set;
}

//  Figuring which propertites could by be used
//
tabulator.panes.utils.propertyTriage = function() {
    if (tabulator.properties == undefined) tabulator.properties = {};
    var kb = tabulator.kb;
    var dp = {}, op = {}, up = {}, no= 0, nd = 0, nu = 0;
    var pi = kb.predicateIndex; // One entry for each pred
    for (var p in pi) {
        var object = pi[p][0].object;
        if (object.termType == 'literal') {
            dp[p] = true;
            nd ++;
        } else {
            op[p] = true;
            no ++;
        }    
    }   // If nothing discovered, then could be either:
    var ps = kb.each(undefined, tabulator.ns.rdf('type'), tabulator.ns.rdf('Property'))
    for (var i =0; i<ps.length; i++) {
        var p = ps[i].toNT();
        tabulator.log.debug("propertyTriage: unknown: "+p)
        if (!op[p] && !dp[p]) {dp[p] = true; op[p] = true; nu++};
    }
    tabulator.properties.op = op;
    tabulator.properties.dp = dp;
    tabulator.log.info('propertyTriage: '+no+' non-lit, '+nd+' literal. '+nu+' unknown.')
}


tabulator.panes.utils.fieldLabel = function(dom, property, form) {
    var lab = tabulator.kb.any(form, tabulator.ns.ui('label'));
    if (!lab) lab = tabulator.Util.label(property, true); // Init capital
    if (property == undefined) return dom.createTextNode('@@Internal error: undefined property');
    var anchor = dom.createElement('a');
    if (property.uri) anchor.setAttribute('href', property.uri);
    anchor.setAttribute('style', 'color: #3B5998; text-decoration: none;');// Not too blue and no underline
    anchor.textContent = lab;
    return anchor
}

/*                      General purpose widgets
**
*/

tabulator.panes.utils.errorMessageBlock = function(dom, msg, backgroundColor) {
    var div = dom.createElement('div');
    div.setAttribute('style', 'padding: 0.5em; border: 0.5px solid black; background-color: ' +
        (backgroundColor  ? backgroundColor :  '#fee') + '; color:black;');
    div.textContent = msg;
    return div;
}

tabulator.panes.utils.bottomURI = function(x) {
    var kb = tabulator.kb;
    var ft = kb.findTypeURIs(x);
    var bot = kb.bottomTypeURIs(ft); // most specific
    var bots = []
    for (var b in bot) bots.push(b);
    // if (bots.length > 1) throw "Didn't expect "+x+" to have multiple bottom types: "+bots;
    return bots[0];
}

tabulator.panes.utils.fieldFunction = function(dom, field) {
    var uri = tabulator.panes.utils.bottomURI(field);
    var fun = tabulator.panes.field[uri];
    tabulator.log.debug("paneUtils: Going to implement field "+field+" of type "+uri)
    if (!fun) return function() {
        return tabulator.panes.utils.errorMessageBlock(dom, "No handler for field "+field+" of type "+uri);
    };
    return fun
}

// A button for editing a form (in place, at the moment)
// 
//  When editing forms, make it yellow, when editing thr form form, pink
// Help people understand how many levels down they are.
//
tabulator.panes.utils.editFormButton = function(dom, container, form, store, callback) {
    var b = dom.createElement('button');
    b.setAttribute('type', 'button');
    b.innerHTML = "Edit "+tabulator.Util.label(tabulator.ns.ui('Form'));
    b.addEventListener('click', function(e) {
        var ff = tabulator.panes.utils.appendForm(dom, container,
                {}, form, tabulator.ns.ui('FormForm'), store, callback);
        ff.setAttribute('style', tabulator.ns.ui('FormForm').sameTerm(form) ?
                    'background-color: #fee;' : 'background-color: #ffffe7;');
        container.removeChild(b);
    }, true);
    return b;
}

// A button for jumping
// 
tabulator.panes.utils.linkButton = function(dom, object) {
    var b = dom.createElement('button');
    b.setAttribute('type', 'button');
    b.textContent = "Goto "+tabulator.Util.label(object);
    b.addEventListener('click', function(e) {
        // b.parentNode.removeChild(b);
        tabulator.outline.GotoSubject(object, true, undefined, true, undefined);
    }, true);
    return b;
}

tabulator.panes.utils.removeButton = function(dom, element) {
    var b = dom.createElement('button');
    b.setAttribute('type', 'button');
    b.textContent = "✕"; // MULTIPLICATION X
    b.addEventListener('click', function(e) {
        element.parentNode.removeChild(element);
    }, true);
    return b;
}

tabulator.panes.utils.appendForm = function(dom, container, already, subject, form, store, itemDone) {
    return tabulator.panes.utils.fieldFunction(dom, form)(
                dom, container, already, subject, form, store, itemDone);
}

//          Find list of properties for class
//
// Three possible sources: Those mentioned in schemas, which exludes many;
// those which occur in the data we already have, and those predicates we
// have come across anywahere and which are not explicitly excluded from
// being used with this class.
//

tabulator.panes.utils.propertiesForClass = function(kb, c) {
    var ns = tabulator.ns;
    var explicit = kb.each(undefined, ns.rdf('range'), c);
    [ ns.rdfs('comment'), ns.dc('title'), // Generic things
                ns.foaf('name'), ns.foaf('homepage')]
        .map(function(x){explicit.push(x)});
    var members = kb.each(undefined, ns.rdf('type'), c);
    if (members.length > 60) members = members.slice(0,60); // Array supports slice? 
    var used = {};
    for (var i=0; i< (members.length > 60 ? 60 : members.length); i++)
                kb.statementsMatching(members[i], undefined, undefined)
                        .map(function(st){used[st.predicate.uri]=true});
    explicit.map(function(p){used[p.uri]=true});
    var result = [];
    for (var uri in used) result.push(kb.sym(uri));
    return result;
}

// @param cla - the URI of the class
// @proap
tabulator.panes.utils.findClosest = function findClosest(kb, cla, prop) {
    var agenda = [kb.sym(cla)]; // ordered - this is breadth first search
    while (agenda.length > 0) { 
        var c = agenda.shift(); // first
        // if (c.uri && (c.uri == ns.owl('Thing').uri || c.uri == ns.rdf('Resource').uri )) continue
        var lists = kb.each(c, prop);
        tabulator.log.debug("Lists for "+c+", "+prop+": "+lists.length)
        if (lists.length != 0) return lists;
        var supers = kb.each(c, tabulator.ns.rdfs('subClassOf'));
        for (var i=0; i<supers.length; i++) {
            agenda.push(supers[i]);
            tabulator.log.debug("findClosest: add super: "+supers[i]); 
        }
    }
    return [];
}

// Which forms apply to a given existing subject?

tabulator.panes.utils.formsFor = function(subject) {
    var ns = tabulator.ns;
    var kb = tabulator.kb;

    tabulator.log.debug("formsFor: subject="+subject);
    var t = kb.findTypeURIs(subject);
    var t1; for (t1 in t) { tabulator.log.debug("   type: "+t1);}
    var bottom = kb.bottomTypeURIs(t); // most specific
    var forms = [ ];
    for (var b in bottom) {
        // Find the most specific
        tabulator.log.debug("formsFor: trying bottom type ="+b);
        forms = forms.concat(tabulator.panes.utils.findClosest(kb, b, ns.ui('creationForm')));
        forms = forms.concat(tabulator.panes.utils.findClosest(kb, b, ns.ui('annotationForm')));
    }
    tabulator.log.debug("formsFor: subject="+subject+", forms=");
    return forms;
}


tabulator.panes.utils.sortBySequence = function(list) {
    var p2 = list.map(function(p) {
        var k = tabulator.kb.any(p, tabulator.ns.ui('sequence'));
        return [k?k:999,p]
    });
    p2.sort(function(a,b){return a[0] - b[0]});
    return p2.map(function(pair){return pair[1]});
}

tabulator.panes.utils.sortByLabel = function(list) {
    var p2 = list.map(function(p) {return [tabulator.Util.label(p).toLowerCase(), p]});
    p2.sort();
    return p2.map(function(pair){return pair[1]});
}



// Button to add a new whatever using a form
//
// @param form - optional form , else will look for one
// @param store - optional store else will prompt for one (unimplemented) 

tabulator.panes.utils.newButton = function(dom, kb, subject, predicate, theClass, form, store, callback)  {
    var b = dom.createElement("button");
    b.setAttribute("type", "button");
    b.innerHTML = "New "+tabulator.Util.label(theClass);
    b.addEventListener('click', function(e) {
            b.parentNode.appendChild(tabulator.panes.utils.promptForNew(
                dom, kb, subject, predicate, theClass, form, store, callback));
        }, false);
    return b;
}



//      Prompt for new object of a given class
//
//
// @param dom - the document DOM for the user interface
// @param kb - the graph which is the knowledge base we are working with
// @param subject - a term, Thing this should be linked to when made. Optional.
// @param predicate - a term, the relationship for the subject link. Optional.
// @param theClass - an RDFS class containng the object about which the new information is.
// @param form  - the form to be used when a new one. null means please find one.
// @param store - The web document being edited 
// @param callback - takes (boolean ok, string errorBody)
// @returns a dom object with the form DOM

tabulator.panes.utils.promptForNew = function(dom, kb, subject, predicate, theClass, form, store, callback) {
    var ns = tabulator.ns;
    var box = dom.createElement('form');
    
    if (!form) {
        var lists = tabulator.panes.utils.findClosest(kb, theClass.uri, ns.ui('creationForm'));
        if (lists.length == 0) {
            var p = box.appendChild(dom.createElement('p'));
            p.textContent = "I am sorry, you need to provide information about a "+
                tabulator.Util.label(theClass)+" but I don't know enough information about those to ask you.";
            var b = box.appendChild(dom.createElement('button'));
            b.setAttribute('type', 'button');
            b.setAttribute('style', 'float: right;');
            b.innerHTML = "Goto "+tabulator.Util.label(theClass);
            b.addEventListener('click', function(e) {
                tabulator.outline.GotoSubject(theClass, true, undefined, true, undefined);
            }, false);
            return box;
        }
        tabulator.log.debug('lists[0] is '+lists[0]);
        form = lists[0];  // Pick any one
    }
    tabulator.log.debug('form is '+form);
    box.setAttribute('style', 'border: 0.05em solid brown; color: brown');
    box.innerHTML="<h3>New "+ tabulator.Util.label(theClass)
                        + "</h3>";

                        
    var formFunction = tabulator.panes.utils.fieldFunction(dom, form);
    var object = tabulator.panes.utils.newThing(store);
    var gotButton = false;
    var itemDone = function(ok, body) {
        if (!ok) return callback(ok, body);
        var insertMe = [];
        if (subject && !kb.holds(subject, predicate, object, store))
                insertMe.push($rdf.st(subject, predicate, object, store));
        if (subject && !kb.holds(object, ns.rdf('type'), theClass, store))
                insertMe.push($rdf.st(object, ns.rdf('type'), theClass, store));
        if (insertMe.length) tabulator.sparql.update([], insertMe, linkDone)
        else callback(true, body)
        if (!gotButton) gotButton = box.appendChild(
                            tabulator.panes.utils.linkButton(dom, object));
        // tabulator.outline.GotoSubject(object, true, undefined, true, undefined);
    }
    var linkDone = function(uri, ok, body) {
        return callback(ok, body);
    }
    tabulator.log.info("paneUtils Object is "+object);
    var f = formFunction(dom, box, {}, object, form, store, itemDone);
    var b = tabulator.panes.utils.removeButton(dom, f);
    b.setAttribute('style', 'float: right;');
    box.AJAR_subject = object;
    return box;
}



//      Description text area
//
// Make a box to demand a description or display existing one
//
// @param dom - the document DOM for the user interface
// @param kb - the graph which is the knowledge base we are working with
// @param subject - a term, the subject of the statement(s) being edited.
// @param predicate - a term, the predicate of the statement(s) being edited
// @param store - The web document being edited 
// @param callback - takes (boolean ok, string errorBody)

tabulator.panes.utils.makeDescription = function(dom, kb, subject, predicate, store, callback) {
    if (!tabulator.sparql) tabulator.sparql = new tabulator.rdf.sparqlUpdate(kb); // @@ Use a common one attached to each fetcher or merge with fetcher
    var group = dom.createElement('div');
    
    var sts = kb.statementsMatching(subject, predicate,undefined); // Only one please
    if (sts.length > 1) return tabulator.panes.utils.errorMessageBlock(dom,
                "Should not be "+sts.length+" i.e. >1 "+predicate+" of "+subject);
    var desc = sts.length? sts[0].object.value : undefined;
    
    var field = dom.createElement('textarea');
    group.appendChild(field);
    field.rows = desc? desc.split('\n').length + 2 : 2;
    field.cols = 80
    var style = 'font-size:100%; white-space: pre-wrap;\
            background-color: white; border: 0.07em solid gray; padding: 1em 0.5em; margin: 1em 1em;'
    field.setAttribute('style', style)
    if (sts.length) field.value = desc 
    else {
        // Unless you can make the predicate label disappear with the first click then this is over-cute
        // field.value = tabulator.Util.label(predicate); // Was"enter a description here"
        field.select(); // Select it ready for user input -- doesn't work
    }

    group.refresh = function() {
        var v = kb.any(subject, predicate);
        if (v && (v.value !== field.value)) {
            field.value = v.value; // don't touch widget if no change
            // @@ this is the place to color the field from the user who chanaged it
        } 
    };
    
    var br = dom.createElement('br');
    group.appendChild(br);
    var submit = dom.createElement('input');
    submit.setAttribute('type', 'submit');
    submit.disabled = true; // until the filled has been modified
    submit.setAttribute('style', 'visibility: hidden; float: right;'); // Keep UI clean
    submit.value = "Save "+tabulator.Util.label(predicate); //@@ I18n
    group.appendChild(submit);

    var saveChange = function(e) {
        submit.disabled = true;
        submit.setAttribute('style', 'visibility: hidden; float: right;'); // Keep UI clean
        field.disabled = true;
        field.setAttribute('style', style + 'color: gray;'); // pending 
        var ds = kb.statementsMatching(subject, predicate);
        var is = $rdf.st(subject, predicate, field.value, store);
        tabulator.sparql.update(ds, is, function(uri, ok, body) {
            if (ok) {
                field.setAttribute('style', style + 'color: black;');
                field.disabled = false;
                
            } else {
                group.appendChild(tabulator.panes.utils.errorMessageBlock(dom, 
                "Error (while saving change to "+store.uri+'): '+body));
            }
            if (callback) callback(ok, body);
        });
    }

    field.addEventListener('keyup', function(e) { // Green means has been changed, not saved yet
        field.setAttribute('style', style + 'color: green;');
        if (submit) {
            submit.disabled = false;
            submit.setAttribute('style', 'float: right;'); // Remove visibility: hidden
        }
    }, true);

    field.addEventListener('change', saveChange, true);
    
    submit.addEventListener('click', saveChange, false)

    return group;
}







// Make SELECT element to select options
//
// @param subject - a term, the subject of the statement(s) being edited.
// @param predicate - a term, the predicate of the statement(s) being edited
// @param possible - a list of terms, the possible value the object can take
// @param options.multiple - Boolean - Whether more than one at a time is allowed 
// @param options.nullLabel - a string to be displayed as the
//                        option for none selected (for non multiple)
// @param options.mint - User may create thing if this sent to the prompt string eg "New foo"
// @param options.subForm - If mint, then the form to be used for minting the new thing
// @param store - The web document being edited 
// @param callback - takes (boolean ok, string errorBody)

tabulator.panes.utils.makeSelectForOptions = function(dom, kb, subject, predicate,
                possible, options, store, callback) {
    if (!tabulator.sparql) tabulator.sparql = new tabulator.rdf.sparqlUpdate(kb);
    tabulator.log.debug('Select list length now '+ possible.length)
    var n = 0; var uris ={}; // Count them
    for (var i=0; i < possible.length; i++) {
        var sub = possible[i];
        // tabulator.log.debug('Select element: '+ sub)
        if (sub.uri in uris) continue;
        uris[sub.uri] = true; n++;
    } // uris is now the set of possible options
    if (n==0 && !options.mint) return tabulator.panes.utils.errorMessageBlock(dom,
                "Can't do selector with no options, subject= "+subject+" property = "+predicate+".");
    
    tabulator.log.debug('makeSelectForOptions: store='+store);
    
    var getActual = function() {
        actual = {};
        if (predicate.sameTerm(tabulator.ns.rdf('type'))) actual = kb.findTypeURIs(subject);
        else kb.each(subject, predicate).map(function(x){actual[x.uri] = true});
        return actual;
    };
    var actual = getActual();
    
    var newObject = null;
    
    var onChange = function(e) {
        select.disabled = true; // until data written back - gives user feedback too
        var ds = [], is = [];
        var removeValue = function(t) {
            if (kb.holds(subject, predicate, t, store)) {
                ds.push($rdf.st(subject, predicate, t, store));
            }
        }
        for (var i =0; i< select.options.length; i++) {
            var opt = select.options[i];
            if (opt.selected && opt.AJAR_mint) {
                var newObject;
                if (options.mintClass) {
                    thisForm = tabulator.panes.utils.promptForNew(dom, kb, subject, predicate, options.mintClass, null, store, function(ok, body){
                        if (!ok) {
                            callback(ok, body); // @@ if ok, need some form of refresh of the select for the new thing
                        }
                    });
                    select.parentNode.appendChild(thisForm);
                    newObject = thisForm.AJAR_subject;
                } else {
                    newObject = tabulator.panes.utils.newThing(store);
                }
                is.push($rdf.st(subject, predicate, newObject, store));
                if (options.mintStatementsFun) is = is.concat(options.mintStatementsFun(newObject));
            }
            if (!opt.AJAR_uri) continue; // a prompt or mint
            if (opt.selected && !(opt.AJAR_uri in actual)) { // new class
                is.push($rdf.st(subject, predicate, kb.sym(opt.AJAR_uri), store ));
            }
            if (!opt.selected && opt.AJAR_uri in actual) {  // old class
                removeValue(kb.sym(opt.AJAR_uri));
                //ds.push($rdf.st(subject, predicate, kb.sym(opt.AJAR_uri), store ));
            }
            if (opt.selected) select.currentURI =  opt.AJAR_uri;                      
        }
        var sel = select.subSelect; // All subclasses must also go
        while (sel && sel.currentURI) {
            removeValue(kb.sym(sel.currentURI));
            sel = sel.subSelect;
        }
        var sel = select.superSelect; // All superclasses are redundant
        while (sel && sel.currentURI) {
            removeValue(kb.sym(sel.currentURI));
            sel = sel.superSelect;
        }
        function doneNew(ok, body) {
            callback(ok, body);
        }
        tabulator.log.info('selectForOptions: stote = ' + store );
        tabulator.sparql.update(ds, is,
            function(uri, ok, body) {
                actual = getActual(); // refresh
                //kb.each(subject, predicate).map(function(x){actual[x.uri] = true});
                if (ok) {
                    select.disabled = false; // data written back
                    if (newObject) {
                        var fn = tabulator.panes.utils.fieldFunction(dom, options.subForm);
                        fn(dom, select.parentNode, {}, newObject, options.subForm, store, doneNew);
                    }
                }
                if (callback) callback(ok, body);
            });
    };
    
    var select = dom.createElement('select');
    select.setAttribute('style', 'margin: 0.6em 1.5em;')
    if (options.multiple) select.setAttribute('multiple', 'true');
    select.currentURI = null;

    select.refresh = function() {
        actual = getActual(); // refresh
        for (var i=0; i < select.children.length; i++) {
            var option = select.children[i];
            if (option.AJAR_uri) {
                option.selected = (option.AJAR_uri in actual);
            }
        }
        select.disabled = false; // unlocked any conflict we had got into
    }
    
    for (var uri in uris) {
        var c = kb.sym(uri)
        var option = dom.createElement('option');
        if (options.disambiguate) {
            option.appendChild(dom.createTextNode(tabulator.Util.labelWithOntology(c, true))); // Init. cap
        } else {
            option.appendChild(dom.createTextNode(tabulator.Util.label(c, true))); // Init.
        }
        var backgroundColor = kb.any(c, kb.sym('http://www.w3.org/ns/ui#backgroundColor'));
        if (backgroundColor) option.setAttribute('style', "background-color: "+backgroundColor.value+"; ");
        option.AJAR_uri = uri;
        if (uri in actual) {
            option.setAttribute('selected', 'true')
            select.currentURI = uri;
            //dump("Already in class: "+ uri+"\n")
        }
        select.appendChild(option);
    }
    if (options.mint) {
        var mint = dom.createElement('option');
        mint.appendChild(dom.createTextNode(options.mint));
        mint.AJAR_mint = true; // Flag it
        select.insertBefore(mint, select.firstChild);
    }
    if ((select.currentURI == null) && !options.multiple) {
        var prompt = dom.createElement('option');
        prompt.appendChild(dom.createTextNode(options.nullLabel));
        select.insertBefore(prompt, select.firstChild)
        prompt.selected = true;
    }
    select.addEventListener('change', onChange, false)
    return select;

} // makeSelectForOptions


// Make SELECT element to select subclasses
//
// If there is any disjoint union it will so a mutually exclusive dropdown
// Failing that it will do a multiple selection of subclasses.
// Callback takes (boolean ok, string errorBody)

tabulator.panes.utils.makeSelectForCategory = function(dom, kb, subject, category, store, callback) {
    var log = tabulator.log;
    var du = kb.any(category, tabulator.ns.owl('disjointUnionOf'));
    var subs;
    var multiple = false;
    if (!du) {
        subs = kb.each(undefined, tabulator.ns.rdfs('subClassOf'), category);
        multiple = true;
    } else {
        subs = du.elements            
    }
    log.debug('Select list length '+ subs.length)
    if (subs.length == 0) return tabulator.panes.utils.errorMessageBlock(dom,
                "Can't do "+ (multiple?"multiple ":"")+"selector with no subclasses of category: "+category);
    if (subs.length == 1) return tabulator.panes.utils.errorMessageBlock(dom,
                "Can't do "+ (multiple?"multiple ":"")+"selector with only 1 subclass of category: "+category+":"+subs[1]);   
    return tabulator.panes.utils.makeSelectForOptions(dom, kb, subject, tabulator.ns.rdf('type'), subs,
                    { 'multiple': multiple, 'nullPrompt': "--classify--"}, store, callback);
}

// Make SELECT element to select subclasses recurively
//
// It will so a mutually exclusive dropdown, with another if there are nested 
// disjoint unions.
// Callback takes (boolean ok, string errorBody)

tabulator.panes.utils.makeSelectForNestedCategory = function(
                dom, kb, subject, category, store, callback) {
    var container = dom.createElement('span'); // Container
    var child = null;
    var select;
    var onChange = function(ok, body) {
        if (ok) update();
        callback(ok, body);
    }
    select = tabulator.panes.utils.makeSelectForCategory(
                dom, kb, subject, category, store, onChange);
    container.appendChild(select);
    var update = function() {
        // tabulator.log.info("Selected is now: "+select.currentURI);
        if (child) { container.removeChild(child); child = null;}
        if (select.currentURI && kb.any(kb.sym(select.currentURI), tabulator.ns.owl('disjointUnionOf'))) {
            child = tabulator.panes.utils.makeSelectForNestedCategory(
                dom, kb, subject, kb.sym(select.currentURI), store, callback)
            select.subSelect = child.firstChild;
            select.subSelect.superSelect = select;
            container.appendChild(child);
        }
    };
    update();
    return container;
}

	
/*  Build a checkbox from a given statement
** 
**  If the source document is editable, make the checkbox editable
** originally in s
*/
tabulator.panes.utils.buildCheckboxForm = function(dom, kb, lab, del, ins, form, store) {
    var box = dom.createElement('div');
    if (!tabulator.sparql) tabulator.sparql = new tabulator.rdf.sparqlUpdate(kb);
    var tx = dom.createTextNode(lab);
    var editable = tabulator.sparql.editable(store.uri);
    tx.className = 'question';
    box.appendChild(tx);
    var input = dom.createElement('input');
    box.appendChild(input);
    input.setAttribute('type', 'checkbox');
    
    state = kb.holds(ins.subject, ins.predicate, ins.object, store);
    if (del) {
        negation = kb.holds(del.subject, del.predicate, del.object, store);
        if (state && negation) {
            box.appendChild(tabulator.panes.utils.errorMessageBlock(dom,
                            "Inconsistent data in store!\n"+ins+" and\n"+del));
            return box;
        }
        if (!state && !negation) {
            state = !!kb.any(form, tabulator.ns.ui('default'));
        }
    }
        
    input.checked = state;
    if (!editable) return box;
    
    var boxHandler = function(e) {
        tx.className = 'pendingedit'; // Grey it out
        if (this.checked) {
            toInsert = ins;
            toDelete = (del && negation) ? del : [];
            tabulator.sparql.update( del && negation? del: [], ins, function(uri,success,error_body) {
                tx.className = 'question';
                if (!success){
                    box.appendChild(tabulator.panes.utils.errorMessageBlock(dom,
                        "Error updating store (setting boolean) "+statement+':\n\n'+error_body));
                    input.checked = false; //rollback UI
                    return;
                } else {
                    state = true;
                    negation = false;
                }
            });
        } else { // unchecked
            toInsert = del;
            toDelete = kb.statementsMatching(ins.subject, ins.predicate, ins.object, store);
            tabulator.sparql.update( toDelete, toInsert, function(uri,success,error_body) {
                tx.className = 'question';
                if (!success){
                    box.appendChild(tabulator.panes.utils.errorMessageBlock(dom,
                        "Error updating store: "+statement+':\n\n'+error_body));
                    input.checked = false; //rollback UI
                    return;
                } else {
                    state = false;
                    negation = !!del;
                }
            });
        }
    }
    input.addEventListener('click', boxHandler, false);
    return box;
}

///////////////////////////////////////// Random I/O widgets /////////////


//////              Column Header Buttons
//
//  These are for selecting different modes, sources,styles, etc.
//
/* 
tabulator.panes.utils.headerButtons = function (dom, kb, name, words) {
    var box = dom.createElement('table');
    var i, word, s = '<tr>'
    box.setAttribute('style', 'width: 90%; height: 1.5em');
    for (i=0; i<words.length; i++) {
        s += '<td><input type="radio" name="' + name + '" id="' + words[i] + '" value=';
    }
    box.innerHTML = s + '</tr>';
    
};
*/
//////////////////////////////////////////////////////////////       
//
//     selectorPanel
//
//  A vertical panel for selecting connections to left or right.
//
//   @param inverse means this is the object rather than the subject
//       
tabulator.panes.utils.selectorPanel = function(dom, kb, type,
    predicate, inverse, possible, options, callback, linkCallback) {
    
    return tabulator.panes.utils.selectorPanelRefresh(dom.createElement('div'),
        dom, kb, type, predicate, inverse, possible, options, callback, linkCallback);
}

tabulator.panes.utils.selectorPanelRefresh = function(list, dom, kb, type,
    predicate, inverse, possible, options, callback, linkCallback) {
    
    var style0 = 'border: 0.1em solid #ddd; border-bottom: none; width: 95%; height: 2em; padding: 0.5em;';
    var selected = null;
    list.innerHTML = '';

    var refreshItem = function(box, x){ // Scope to hold item and x

        var item, image;
        
        var setStyle = function(){
            var already = (inverse)   ? kb.each(undefined, predicate, x)
                                    : kb.each(x, predicate);
            iconDiv.setAttribute('class', already.length == 0 ? 'hideTillHover':''); // See tabbedtab.css
            image.setAttribute('src', tabulator.iconPrefix + 'js/panes/attach/tbl-paperclip-22a.png');
            image.setAttribute('title', already.length ? already.length : 'attach');
        }
        var f = tabulator.panes.widget.twoLine.widgetForClass(type); 
        item = f(dom, x);
        item.setAttribute('style', style0);
        
        var nav = dom.createElement('div');
        nav.setAttribute('class', 'hideTillHover'); // See tabbedtab.css
        nav.setAttribute('style', 'float:right; width:10%');

        var a = dom.createElement('a');
        a.setAttribute('href',x.uri);
        a.setAttribute('style', 'float:right');
        nav.appendChild(a).textContent = '>';                 
        box.appendChild(nav);

        var iconDiv = dom.createElement('div');
        iconDiv.setAttribute('style', (inverse ? 'float:left;' : 'float:right;') + ' width:30px;' );
        image = dom.createElement('img');
        setStyle();
        iconDiv.appendChild(image)
        box.appendChild(iconDiv);

        item.addEventListener('click', function(event){
            if (selected == item) { // deselect
                item.setAttribute('style', style0);
                selected = null;
            } else {
                if (selected) selected.setAttribute('style', style0);
                item.setAttribute('style', style0 + 'background-color: #ccc; color:black;');
                selected = item;
            }
            callback(x, event, selected == item);
            setStyle();
        }, false);

        image.addEventListener('click', function(event){
            linkCallback(x, event, inverse, setStyle);
        }, false);
        
        box.appendChild(item);
        return box;
    };
    
    for (var i=0; i < possible.length; i++) {
        var box = dom.createElement('div');
        list.appendChild(box);
        refreshItem (box, possible[i]);
    };
    return list;
};




//###########################################################################
//
//      Small compact views of things
//
tabulator.panes.widget = {};
tabulator.panes.widget.line = {}; // Approx 80em
tabulator.panes.widget.twoLine = {}; // Approx 40em * 2.4em


/////////////////////////////////////////////////////////////////////////////
 // We need these for anything which is a subject of an attachment.
 //
 // These should be moved to type-dependeent UI code. Related panes maybe
 
tabulator.panes.widget.twoLine[''] = function(dom, x) { // Default
    var box = dom.createElement("div");
    box.textContent = (tabulator.Util.label(x));
    return box;
};

tabulator.panes.widget.twoLine.widgetForClass = function(c) {
    var widget = tabulator.panes.widget.twoLine[c.uri];
    var kb = tabulator.kb;
    if (widget) return widget;
    var sup =  kb.findSuperClassesNT(c);
    for (var cl in sup) {
        widget = tabulator.panes.widget.twoLine[kb.fromNT(cl).uri];
        if (widget) return widget;
    }
    return tabulator.panes.widget.twoLine[''];
};
 
tabulator.panes.widget.twoLine[
    'http://www.w3.org/2000/10/swap/pim/qif#Transaction'] = function(dom, x) {
    var failed = "";
    var enc = function(p) {
        var y = tabulator.kb.any(x, tabulator.ns.qu(p));
        if (!y) failed += "@@ No value for " + p +"! ";
        return y ? tabulator.Util.escapeForXML(y.value) : '?';   // @@@@
    };
    var box = dom.createElement("table");
    box.innerHTML = '<tr><td colspan="2">' + enc('payee') + 
        '</td></tr>\n<tr><td><td>' + enc('date').slice(0,10) +
        '</td><td style="text-align: right;">' + enc('amount') + '</td></tr>';
    if (failed) box.innerHTML = '<tr><td><a href="' + 
        tabulator.Util.escapeForXML(x.uri) + '">' + 
        tabulator.Util.escapeForXML(failed) + '</a></td></tr>';
    return box;
};
 
tabulator.panes.widget.twoLine[
    'http://www.w3.org/ns/pim/trip#Trip'] = function(dom, x) {
    var enc = function(p) {
        var y = tabulator.kb.any(x, p);
        return y ? tabulator.Util.escapeForXML(y.value) : '?';
    };
    var box = dom.createElement("table");
    box.innerHTML = '<tr><td colspan="2">' + enc(tabulator.ns.dc('title')) + 
        '</td></tr>\n<tr style="color: #777"><td><td>' +
        enc(tabulator.ns.cal('dtstart')) + '</td><td>' + enc(tabulator.ns.cal('dtend'))
        + '</td></tr>';
    return box;
};




// ends


