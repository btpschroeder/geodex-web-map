// when document is ready...
$(document).ready(function(){
    makeTheMap(); //... render the map
});

/////////////////////////////////////////////////
// map rendering!                              //
// (pretty much all map-related stuff)         //
/////////////////////////////////////////////////

    function makeTheMap() {
        
        // initialize the map
        var theMap = L.map('map') // draw the map in the element with an id of "map"
            .setView([43.038902, -87.906474], // by default, center to Milwaukee...
            6) // ...with a zoom level of 6
            .setMaxBounds([ // with this method, the map will "bounce" back once the user hits the map boundary
                [-180, -180], // this is because esri-leaflet querying gets confused otherwise
                [180, 180]
            ]);
            
        // disable "search current extent" button by default
        $('#search-current-extent').prop('disabled', 'disabled');
            
        // this variable holds the minimum zoom level needed to activate "search current extent" button
        var minExtentZoom = 8;
            
        // add individual basemap layers
        var osmBasemap = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            minZoom: 4,
            maxZoom: 19,
            attribution: 'Basemap &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        });            
        var esriWorldImageryBasemap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            minZoom: 4,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });
        var esriWorldTopoMap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
            minZoom: 4,
            attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
        });
        var esriWorldStreetMap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
            minZoom: 4,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
        });
            
        // add the default basemap to the map
        esriWorldTopoMap.addTo(theMap);
        
        // add a layer group containing all the basemap layers; then add the layer group to the map with controllers
        var basemaps = {
            "Esri World Topographic Map": esriWorldTopoMap,
            "Esri World Imagery": esriWorldImageryBasemap,
            "Esri World Street Map": esriWorldStreetMap,
            "OSM Mapnik": osmBasemap
        }
        var basemapsControl = L.control.layers(basemaps).addTo(theMap);
        
        // is there currently a feature outline on the map?
        var outlineOnMap = false;
        
        // a group to hold the feature outlines
        var temporaryLayerGroup;
        
        // add esri geocoder to map
        var geocoderControl = L.esri.Geocoding.geosearch();
        geocoderControl.addTo(theMap);
         
        /////////////////////////////////////////////////
        // when map is zoomed in enough, activate the  //
        // "search current extent" button on the left  //
        /////////////////////////////////////////////////
         
        theMap.on('zoomend', function(){ // whenever the map is zoomed in or out...
            var currentZoom = theMap.getZoom(); // ...store the current zoom level in a variable
            if(currentZoom >= minExtentZoom) { // if the current zoom level is the minimum zoom variable declared above, or higher, enable the "search current extent" button
                $('#search-current-extent').prop('disabled', '');
            } else { // otherwise, disable it
                $('#search-current-extent').prop('disabled', 'disabled');
            }
        });
        
        /////////////////////////////////////////////////
        // search current extent                       //
        /////////////////////////////////////////////////
        
        $('#search-current-extent').on('click', function(){ // when the user clicks the "search current extent" button...
            var currentMapBounds = theMap.getBounds(); // ...get the boundaries of the current map extent
            var sw = currentMapBounds._southWest; // assign the southwest boundary to a variable
            var ne = currentMapBounds._northEast; // assign the northeast boundary to a variable
            var queryBounds = L.latLngBounds(sw, ne); // combine the boundaries into a leaflet latlong object
            
            var geodexSearchQuery = L.esri.query({
                url: 'http://webgis.uwm.edu/arcgisuwm/rest/services/AGSL/GeodexWebMapService/MapServer/0'
            });
            
            if ($('#search-intersect').prop("checked")) {
                geodexSearchQuery.intersects(queryBounds);
                // note that 'intersects' means features need only be partially included in the map extent to show up in the search results
            } else if ($('#search-within').prop("checked")){
                geodexSearchQuery.within(queryBounds);
                // whereas this returns only features ENTIRELY WITHIN the current extent
            }
            
            geodexSearchQuery.run(function(error, featureCollection, response){
                // pass all of the query results to the displaySearchResults function
                displaySearchResults(featureCollection.features);
            });
        });
        
        /////////////////////////////////////////////////
        // display search results                      //
        /////////////////////////////////////////////////

        function displaySearchResults(s) { // in this function, the s parameter refers to search results passed in
        
            var temporaryLayer;

            var resultsHtml = // all of the output html will be stored in this variable
                '<p><button type="button" class="btn btn-default" id="clear-results">Clear search results</button>' +
                '<p>' +
                'Found <strong>' + s.length + '</strong> results in ';
                
            var seriesArray = []; // this will allow the application to group search results by map series
                
            for (i = 0; i < s.length; i++) { // loop through every search result and create an array containing all series names
                if (seriesArray.indexOf(s[i].properties.SERIES_TIT) < 0) {
                    seriesArray.push(s[i].properties.SERIES_TIT); // if series is not already in array, add it
                }
            }
            
            if ( seriesArray.indexOf(null) >= 0 ) { // if a null value shows up in series list, call it something more descriptive
                var index = seriesArray.indexOf(null);
                seriesArray[index] = "No associated series";
            }
            
            resultsHtml += ('<strong>' + seriesArray.length + '</strong> series.</p>')
            
            for (j = 0; j < seriesArray.length; j++) { // create headings and lists for each category in the search results
                resultsHtml += (
                    '<h3>' + seriesArray[j] + '</h3>'
                    + '<ul>'
                    + makeCategorizedList(seriesArray[j])
                    + '</ul>'
                )
            }
            
            function makeCategorizedList(cat) { // create individual <li>s for each <ul> created in the for loop above
                var listToReturn = '';
                for (h = 0; h < s.length; h++) {
                    if (cat === s[h].properties.SERIES_TIT) {
                        listToReturn += (
                            '<li><span class="search-result" id="' + s[h].properties.OBJECTID + '">' + s[h].properties.DATE + ' &ndash; ' + s[h].properties.RECORD + '</span><a href="#" class="attr-modal-link" id="info-' + s[h].properties.OBJECTID + '" data-toggle="modal" data-target="#attrModal"><i class="fa fa-lg fa-info-circle aria-hidden="true"></i></a></li>'
                        )
                    } else if (cat === "No associated series" && s[h].properties.SERIES_TIT === null) { // need this to deal with series containing a null value
                        listToReturn += (
                            '<li><span class="search-result" id="' + s[h].properties.OBJECTID + '">' + s[h].properties.DATE + ' &ndash; ' + s[h].properties.RECORD + '</span><a href="#" class="attr-modal-link" id="info-' + s[h].properties.OBJECTID + '" data-toggle="modal" data-target="#attrModal"><i class="fa fa-lg fa-info-circle aria-hidden="true"></i></a></li>'
                        )
                    }
                }
                return listToReturn;
            }
            
            $('#search-results').html( // once everything else is done, change the "search-results" div's html to match that of the resultsHtml variable
                resultsHtml
            );
            
            // click "clear search results" to empty search results entirely
            $('#clear-results').on('click', function(){
                removeAllOutlines();
                $('#search-results').empty();
            });
            
            // show feature boundary upon hover
            $('.search-result').on('click', function(){
                removeAllOutlines();
                var featureId = $(this).attr('id');
                var geodexBoundsQuery = L.esri.query({
                    url: 'http://webgis.uwm.edu/arcgisuwm/rest/services/AGSL/GeodexWebMapService/MapServer/0'
                });
                geodexBoundsQuery
                    .where('"OBJECTID" = '+ featureId);
                geodexBoundsQuery.run(function(error, featureToDisplay, response){
                    var thisFeaturesGeometry = featureToDisplay.features[0].geometry.coordinates[0];
                    for (i = 0; i < thisFeaturesGeometry.length; i++) {
                        thisFeaturesGeometry[i].reverse();
                    }
                temporaryLayer = L.polygon(thisFeaturesGeometry, {color: 'red'});
                temporaryLayerGroup = L.layerGroup([temporaryLayer]);
                temporaryLayerGroup.addTo(theMap);
                outlineOnMap = true;
                });
            });
            
            /////////////////////////////////////////////////
            // click on info icon, get modal with attrs    //
            /////////////////////////////////////////////////

                $('.attr-modal-link').on('click', function(){
                    
                    // what record are we currently looking at? use the assigned id to figure it out
                    var featureToLookup = ($(this).attr('id')).replace('info-', '');
                    
                    // get the properties for the record
                    var geodexAttrQuery = L.esri.query({
                        url: 'http://webgis.uwm.edu/arcgisuwm/rest/services/AGSL/GeodexWebMapService/MapServer/0'
                    });
                    geodexAttrQuery
                        .where('"OBJECTID" = '+ featureToLookup);
                    geodexAttrQuery.run(function(error, featureWeFound, response){
                        
                        var attr = featureWeFound.features[0].properties;
                        var attrKeys = Object.keys(attr);
                        
                        // and now it's time to populate our modal with the attributes!
                        $('#attrModalLabel').html('<strong>Attributes:</strong> ' + attr.DATE + ' &ndash; ' + attr.RECORD);
                        
                        // procedurally generate the table, because we're lazy and doing it manually sounds boring
                        for (b = 0; b < attrKeys.length; b++) {
                            // grab the current attribute
                            var currentAttribute = attrKeys[b];
                            // grab the current value for the current attribute
                            var currentValue = attr[currentAttribute];
                            // throw them both in an html string
                            var tableRowHtml = ( '<tr><td><strong>' + currentAttribute + '</strong></td><td>' + currentValue + '</td></tr>');
                            
                            if (b === 0 || b <= ((attrKeys.length / 2) - 1)) { // throw the first half of all attributes in table #1
                                $('#attr-table-1>tbody').append(tableRowHtml);
                            } else  { // throw the rest in table #2
                                $('#attr-table-2>tbody').append(tableRowHtml);
                            }
                        }
                    
                    });
                    
                });
        }
        
        
        /////////////////////////////////////////////////
        // remove feature outline on map               //
        /////////////////////////////////////////////////
        
        function removeAllOutlines() {
            if(outlineOnMap) {
                temporaryLayerGroup.remove();
                outlineOnMap = false;
            }
        }
        
    }
    
/////////////////////////////////////////////////
// empty attribute modal when user closes it   //
/////////////////////////////////////////////////

    $("#attrModal").on('hide.bs.modal', function(){
        
        $('#attr-table-1>tbody').empty();
        $('#attr-table-2>tbody').empty();
        
    });