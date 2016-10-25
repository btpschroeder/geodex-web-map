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
            6); // ...with a zoom level of 6
            
        // disable "search current extent" button by default
        $('#search-current-extent').prop('disabled', 'disabled');
            
        // this variable holds the minimum zoom level needed to activate "search current extent" button
        var minExtentZoom = 9;
            
        // add individual basemap layers
        var osmBasemap = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            minZoom: 4,
            maxZoom: 19,
            attribution: 'Basemap &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        });            
        var esriWorldImageryBasemap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });
        var esriWorldTopoMap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
            attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
        });
        var esriWorldStreetMap = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
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
                console.log("intersects search");
                geodexSearchQuery.intersects(queryBounds);
                // note that 'intersects' means features need only be partially included in the map extent to show up in the search results
            } else if ($('#search-within').prop("checked")){
                console.log("within search");
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
                'Found <strong>' + s.length + '</strong> matching results.' +
                '</p>';
                
            for (i = 0; i < s.length; i++) { // loop through every search result and create html based on each record
                var props = s[i].properties; // change properties object to "props" to make writing html below easier
                resultsHtml += ('<p class="search-result" id=' + props.OBJECTID +'><strong>' + props.LOCATION + '</strong><br /><em>' + props.SERIES_TIT + '</em><br />' + props.CATLOC +'</p>');
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