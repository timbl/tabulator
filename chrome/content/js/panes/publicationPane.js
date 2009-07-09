/*
 * File: publicationPane.js
 * Purpose: Pane that contains publication data, such as author(s), publishing date, location, etc.
 */

/***
 * Most of the following code will change. This is a work in progress.
 ***/

//load('RDFTreeSearcher.js');

var tabulator = Components.classes["@dig.csail.mit.edu/tabulator;1"].getService(Components.interfaces.nsISupports).wrappedJSObject;
tabulator.panes.register(tabulator.panes.publishingPane = new function() {
    this.name = 'Publication';
    this.icon = Icon.src.icon_publicationPane;
	
    this.label = function(subject) {
        var typeTriples = tabulator.kb.statementsMatching(subject,tabulator.ns.rdf('type'),null,null); // Stores all the 'types' of the URI in an array
        if(this.isEmpty(typeTriples)) return null;
        for(var ind = 0;ind < typeTriples.length;ind++) {
            if(this.isEmpty(typeTriples[ind])) continue;
            else if(tabulator.kb.whether(typeTriples[ind].object,tabulator.ns.rdfs('subClassOf'),tabulator.ns.bibo('Document'),null))
                return this.name;
        }
        return null;
    }

    this.render = function(subject, document) {
        var div = document.createElement('div');
        div.setAttribute('id','publicationPane');
        var bibo = tabulator.ns.bibo; // for aesthetics
        var foaf = tabulator.ns.foaf;
        var dct = tabulator.ns.dct;
        var owl = tabulator.ns.owl;
        var rdf = tabulator.ns.rdf;

        var ps = new PatternSearch();

        var nameTree = ps.SOBN([
                                ps.ABN([
                                        ps.SPEN(foaf('givenname')),
                                        ps.SOBN([
                                                 ps.SPEN(foaf('family_name')),
                                                 ps.SPEN(foaf('surname'))
                                                ])
                                       ]),
                                ps.SPEN(foaf('name')),
                                ps.SPEN(dct('name'))
                               ]);
        var titleNameTree = ps.SOBN([
                                     ps.ABN([
                                             ps.SPEN(foaf('title')),
                                             nameTree
                                            ]),
                                     nameTree
                                    ]);
        var personNameTree = ps.SOBN([
                                      ps.MOTN(foaf('Person'),[
                                                              titleNameTree
                                                             ])
                                     ]);
        
        var authorTree = ps.MOBN([
                                  ps.SOPN(bibo('authorList'),[
                                                              personNameTree
                                                             ]),
                                  ps.SOPN(bibo('contributorList'),[
                                                                   personNameTree
                                                                  ]),
                                  ps.MOPN(dct('creator'),[
                                                          titleNameTree
                                                         ])
                                 ]);
        var editorTree = ps.SOBN([
                                  ps.SOPN(bibo('editorList'),[
                                                              personNameTree
                                                             ]),
                                  ps.MOPN(bibo('editor'),[
                                                          titleNameTree,
                                                          personNameTree
                                                         ])
                                 ]);
        ps.debug = false;
        var ownerNameTree = ps.SOBN([
                                     ps.SOBN([
                                              ps.MOPN(bibo('owner'),[
                                                                     titleNameTree
                                                                    ])
                                             ])
                                    ]);

        var titleTree = ps.SOBN([
                                 ps.SPEN(bibo('shortTitle')),
                                 ps.SPEN(dct('title'))
                                ]);

        var dateTree = ps.SOBN([
                                ps.SPEN(dct('created')),
                                ps.SPEN(dct('date'))
                               ]);

        var abstractTree = ps.SOBN([
                                    ps.SPEN(dct('abstract'))
                                   ]);

        var dataToAssemble = [['Author(s)',ps.parseResults(authorTree.fetch(subject)),'pubAuthor'],
                              ['Title',ps.parseResults(titleTree.fetch(subject)),'pubTitle'],
                              ['Date created',ps.parseResults(dateTree.fetch(subject)),'pubDateCreated'],
                              ['Abstract',ps.parseResults(abstractTree.fetch(subject)),'pubAbstract'],
                              ['Owner',ps.parseResults(ps.debugStatement(ownerNameTree.fetch(subject))),'pubOwner']];

        for(var i = 0;i < dataToAssemble.length;i++)
            div = this.appendEntry(document, div, dataToAssemble[i][0], dataToAssemble[i][1], dataToAssemble[i][2]);

        //alert("statementsMatching: "+tabulator.kb.statementsMatching(tabulator.kb.sym("http://www.advogato.org/person/timbl/foaf.rdf#me"),rdf('type'))+"\nwhether: "+tabulator.kb.statementsMatching(tabulator.kb.sym("http://www.advogato.org/person/timbl/foaf.rdf#me"),rdf('type'),foaf('Person'))+"\nsource of foaf(Person): "+foaf('Person').toSource());
   
        return div;
    }

    /* Helper Functions */
    // This function was being troublesome. After some tinkering, it turns out that instantiating a string with
    // double quotes instead of single quotes fixes the issue. NOTE: double quotes are safer.
    this.appendEntry = function(doc,div,tag,data,divClass) {
        if(data == null) return div;
        var subDiv = doc.createElement('div');
        subDiv.setAttribute('class',divClass);
        var label = doc.createTextNode(tag);
        var list = doc.createElement('ul');
        for(var index = 0;index < data.length;index++) {
            li = doc.createElement('li');
            li.innerHTML = escapeForXML(data[index].toString());
            list.appendChild(li);
        }
        div.appendChild(subDiv);
        subDiv.appendChild(label);
        subDiv.appendChild(list);
        return div;
    }

    this.isEmpty = function(arr) {
        if(arr == null) return true;
        else if(arr.length == 0) return true;
        else return false;
    }
}, false);