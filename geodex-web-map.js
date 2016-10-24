// set up query url (map service)
var geodexQuery = L.esri.query({
    url: 'http://webgis.uwm.edu/arcgisuwm/rest/services/AGSL/GeodexPolandOnly/MapServer/0'
});

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
            .setView([52.230618, 19.364278], // by default, center to Kutno, Poland...
            6); // ...with a zoom level of 6
            
        // disable "search current extent" button by default
        $('#search-current-extent').prop('disabled', 'disabled');
            
        // this variable holds the minimum zoom level needed to activate "search current extent" button
        var minExtentZoom = 10;
            
        // add basemap: currently OpenStreetMap.Mapnik
        var basemapLayer = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            minZoom: 4,
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> | Powered by <a href="http://esri.com/">Esri</a>'}); 
        basemapLayer.addTo(theMap);
        
        /*
        // add geodex features to the map via map service on uwm's arcgis server
        var geodexFeatures = L.esri.featureLayer({
            url: 'http://webgis.uwm.edu/arcgisuwm/rest/services/AGSL/GeodexPolandOnly/MapServer/0'
        });
        geodexFeatures.addTo(theMap);
        
        // bind popups to geodex features, displayed upon clicking feature layer
        geodexFeatures.bindPopup(function(data) {
            return L.Util.template(
                // this is the HTML rendered when somebody clicks on a feature
                // put fields from the dataset between curly braces {}
                '<strong>{LOCATION}</strong><br /><em>{SERIES_TIT}</em><br />Date: {DATE}',
                data.feature.properties
            );
        });
        */
        
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
            
            geodexQuery.intersects(queryBounds); // set up the query
            // note that 'intersects' means features need only be partially included in the map extent to show up in the search results
            // other query methods are possible: https://esri.github.io/esri-leaflet/api-reference/tasks/query.html
            
            geodexQuery.run(function(error, featureCollection, response){
                // pass all of the query results to the displaySearchResults function
                console.log(featureCollection.features);
                displaySearchResults(featureCollection.features);
            });
        });
        
        /////////////////////////////////////////////////
        // display search results                      //
        /////////////////////////////////////////////////

        function displaySearchResults(s) { // in this function, the s parameter refers to search results passed in

            var resultsHtml = // all of the output html will be stored in this variable
                '<p><button type="button" class="btn btn-default" id="clear-results">Clear search results</button>'
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
                console.log('clearing results');
                $('#search-results').empty();
            });
            
            // show feature boundary upon hover
            $('.search-result').on('mouseover', function(){
                var featureId = $(this).attr('id');
                geodexQuery
                    .where('"OBJECTID" = '+ featureId);
                geodexQuery.run(function(error, featureToDisplay, response){
                    var thisFeaturesGeometry = featureToDisplay.features[0].geometry.coordinates[0];
                    console.log(featureToDisplay.features[0]);
                    L.polygon(thisFeaturesGeometry, {color: 'red'}).addTo(theMap);
                });
            });
            
        }
        
    }