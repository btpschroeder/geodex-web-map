var savedRecords = []; // this array will store any records the user has chosen to "bookmark"
var searchTheseSeries = []; // this array will store the series that the user wishes to search
var mapService = 'http://webgis.uwm.edu/arcgisuwm/rest/services/AGSL/GeodexWebMapService/MapServer/0'; // the url for our map service; will be referenced in a lot of places

// when document is ready...
$(document).ready(function(){
    makeTheMap(); //... render the map
    
    /////////////////////////////////////////////////
    // populate "years" drown-down automatically   //
    /////////////////////////////////////////////////
    
        /*
            EDIT THE FOLLOWING LINE IF A MAP IS ADDED TO GEODEX WITH AN EARLIER YEAR!
        */
        var minYear = 1829; // <--- THIS ONE
        var currentYear = new Date().getFullYear();
        var dropdownYearsList;
        for (y = minYear; y <= currentYear; y++){
            dropdownYearsList += ('<option value="' + y + '" id="' + y +'">' + y + '</option>');
        }
        $('#years-from').html(dropdownYearsList);
        $('#years-to').html(dropdownYearsList);
        $('#years-to #' + currentYear).attr('selected', 'selected');
        
        // Give users an alert message if their chosen year range is invaild
        $('#years-from').change(function(){ validateYears(); });
        $('#years-to').change(function(){ validateYears(); });
        function validateYears() {
            var x = $('#years-from').val();
            var y = $('#years-to').val();
            if (x > y){
                $('#years-not-in-order').css('display', 'block');
            } else {
                $('#years-not-in-order').css('display', 'none');
            }
        }
        
    /////////////////////////////////////////////////
    // populate "series" drown-down automatically  //
    /////////////////////////////////////////////////

        // this array will hold all of the unique SERIES_TIT values
        var uniqueSeriesArray = [];
        
        // the number of characters to display in the series dropdown before cutting off
        var maximumSeriesLength = 65;
    
        // get all unique series names... for more explanation: https://github.com/Esri/esri-leaflet/issues/880
        var uniqueSeriesValuesQuery = L.esri.query({
            url: mapService
        });
        uniqueSeriesValuesQuery.where('1=1');
        uniqueSeriesValuesQuery.returnGeometry(false);
        uniqueSeriesValuesQuery.fields(['SERIES_TIT']);
        uniqueSeriesValuesQuery.params.returnDistinctValues = true;
        
        // add all unique SERIES_TIT attributes to uniqueSeriesArray
        uniqueSeriesValuesQuery.run(function (err, res, raw) {
            for (f = 0; f < res.features.length; f++){
                var currentSeries = (res.features[f].properties.SERIES_TIT);
                uniqueSeriesArray.push(currentSeries);
                if (f === (res.features.length - 1)){
                    // alphabetize the array once all SERIES_TIT values are included
                    uniqueSeriesArray.sort();
                    createSeriesHtml(uniqueSeriesArray);
                }
            }
        });
        
        function createSeriesHtml(arr) {
            var seriesHtml = '<option value="series-none" id="series-none">No series selected</option>';
            for (b = 0; b < uniqueSeriesArray.length; b++){
                if (uniqueSeriesArray[b] !== null){
                    if (uniqueSeriesArray[b].length >= maximumSeriesLength) {
                        seriesHtml += ('<option value="' + b + '" id="series-' + b +'">' + (uniqueSeriesArray[b]).substring(0, maximumSeriesLength) + '...</option>');
                    } else {
                        seriesHtml += ('<option value="' + b + '" id="series-' + b +'">' + uniqueSeriesArray[b] + '</option>');
                    }
                }
            }
            $('#series-list').html(seriesHtml);
        }
        
        // when the user selects a new series for the query...
        $('#series-list').on('change', function(){
            var currentIndex = $(this).val();
            searchTheseSeries = uniqueSeriesArray[currentIndex];
        });

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
                var currentMapBounds = theMap.getBounds(); // ...get the boundaries of the current map extent...
                var currentMapCenter = theMap.getBounds().getCenter(); // ...and get the center of the current map extent
                var sw = currentMapBounds._southWest; // assign the southwest boundary to a variable
                var ne = currentMapBounds._northEast; // assign the northeast boundary to a variable
                var queryBounds = L.latLngBounds(sw, ne); // combine the boundaries into a leaflet latlong object
                
                var sqlQuery = makesqlQuery();
                
                var geodexSearchQuery = L.esri.query({
                    url: mapService
                });
                
                if ($('#search-intersect').prop("checked")) {
                    geodexSearchQuery.intersects(queryBounds)
                    .where(sqlQuery);
                } else if ($('#search-within').prop("checked")){
                    geodexSearchQuery.within(queryBounds)
                    .where(sqlQuery);
                } else if ($('#search-center').prop("checked")){
                    geodexSearchQuery.intersects(currentMapCenter)
                    .where(sqlQuery);
                }
                
                geodexSearchQuery.run(function(error, featureCollection, response){
                    // pass all of the query results to the displaySearchResults function
                    if (error) {
                        console.log(error);
                    }
                    displaySearchResults(featureCollection.features);
                });
            });
        
        /////////////////////////////////////////////////
        // display search results                      //
        /////////////////////////////////////////////////

            function displaySearchResults(s) { // in this function, the s parameter refers to search results passed in
            
                function showTheResults(s) {}
                    
                var temporaryLayer;
                var alertHtml;
                
                if (s.length === 1000) {
                    alertHtml = '<div class="alert alert-danger" role="alert"><strong>Your search returned too many results. Only the first 1000 will be displayed below.</strong> Adjust your search parameters to return more specific records.</div>';
                } else if (s.length > 100 && s.length < 1000) {
                    alertHtml = '<div class="alert alert-warning" role="alert"><strong>Your search returned more than 100 results.</strong> All of them are displayed below. You may wish to adjust your search parameters to return more specific records.</div>';
                } else {
                    alertHtml = '';
                }

                var resultsHtml = // all of the output html will be stored in this variable
                    '<h2>Seach Results</h2>' +
                    '<p><button type="button" class="btn btn-default" id="clear-results">Clear search results</button>' +
                    alertHtml + // were any alerts called above?
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
                        + '<ul class="list-group">'
                        + makeCategorizedList(seriesArray[j])
                        + '</ul>'
                    )
                }
                
                function makeCategorizedList(cat) { // create individual <li>s for each <ul> created in the for loop above
                    var listToReturn = '';
                    for (h = 0; h < s.length; h++) {
                        if (cat === s[h].properties.SERIES_TIT) {
                            listToReturn += (
                                '<li class="list-group-item"><a href="#" class="show-map-outline-link" id="show-outline-' + s[h].properties.OBJECTID +'"><i class="fa fa-lg fa-map" aria-hidden="true"></i></a><a href="#" class="attr-modal-link" id="info-' + s[h].properties.OBJECTID + '" data-toggle="modal" data-target="#attrModal"><i class="fa fa-lg fa-info-circle aria-hidden="false"></i></a><span class="search-result">' + s[h].properties.DATE + ' &ndash; ' + s[h].properties.RECORD + '</span><a href="#" class="bookmark-link add-bookmark" id="add-bookmark-' + s[h].properties.OBJECTID +'"><i class="fa fa-lg fa-bookmark-o" aria-hidden="false"></i></a></li>'
                            )
                        } else if (cat === "No associated series" && s[h].properties.SERIES_TIT === null) { // need this to deal with series containing a null value
                            listToReturn += (
                               '<li class="list-group-item"><a href="#" class="show-map-outline-link" id="show-outline-' + s[h].properties.OBJECTID +'"><i class="fa fa-lg fa-map" aria-hidden="true"></i></a><a href="#" class="attr-modal-link" id="info-' + s[h].properties.OBJECTID + '" data-toggle="modal" data-target="#attrModal"><i class="fa fa-lg fa-info-circle aria-hidden="false"></i></a><span class="search-result">' + s[h].properties.DATE + ' &ndash; ' + s[h].properties.RECORD + '</span><a href="#" class="bookmark-link add-bookmark" id="add-bookmark-' + s[h].properties.OBJECTID +'"><i class="fa fa-lg fa-bookmark-o" aria-hidden="false"></i></a></li>'
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
            
            /////////////////////////////////////////////////
            // show feature boundary link                  //
            /////////////////////////////////////////////////
            
                $('.show-map-outline-link').on('click', function(){
                    // grab the current zoom level and bounds right away -- to be used with the return to previous extent link
                    var rememberLastExtent = {
                        zoom: theMap.getZoom(),
                        bounds: theMap.getBounds()
                    };
                    removeAllOutlines();
                    var featureId = $(this).attr('id').replace('show-outline-', '');
                    var geodexBoundsQuery = L.esri.query({
                        url: mapService
                    });
                    geodexBoundsQuery
                        .where('"OBJECTID" = '+ featureId);
                    geodexBoundsQuery.run(function(error, featureToDisplay, response){
                        var thisFeaturesGeometry = featureToDisplay.features[0].geometry.coordinates[0];
                        for (i = 0; i < thisFeaturesGeometry.length; i++) {
                            thisFeaturesGeometry[i].reverse();
                        }
                    temporaryLayer = L.polygon(thisFeaturesGeometry, {color: 'red'});
                    // check to see if outlined feature is in current map extent; pan to it if not
                    var currentExtent = theMap.getBounds();
                    var containTest = currentExtent.intersects(thisFeaturesGeometry); // returns true if outline is in current extent, false if not
                    if(containTest === false) {
                        var panToHere = temporaryLayer.getBounds().getCenter(); // if necessary, pan to the center of the outline
                        theMap.panTo(panToHere, {
                            animate: true
                        });
                    }
                    temporaryLayerGroup = L.layerGroup([temporaryLayer]);
                    temporaryLayerGroup.addTo(theMap);
                    outlineOnMap = true;
                    });
                
                /////////////////////////////////////////////////
                // return to previous extent                   //
                /////////////////////////////////////////////////
                
                    $('.previous-extent').on('click', function(){
                        theMap.panTo(rememberLastExtent.bounds);
                        theMap.zoomTo(rememberLastExtent.zoom);
                        $(this).remove();
                    });
                
            });
            
            /////////////////////////////////////////////////
            // click on bookmark icon                      //
            /////////////////////////////////////////////////
            
                $('.bookmark-link').on('click', function(){
                    
                    // use the link's class to determine whether or not this is an "add" or "remove" bookmark link
                    var thisIsAddLink = $(this).hasClass('add-bookmark');
                    
                    if(thisIsAddLink) {
                        var bookmarkThis = $(this).attr('id').replace('add-bookmark-', '');
                        savedRecords.push(bookmarkThis);
                        $(this).removeClass('add-bookmark');
                        $(this).addClass('remove-bookmark');
                        $(this).attr('id', ('remove-bookmark-' + bookmarkThis));
                        $(this).html('<i class="fa fa-lg fa-bookmark" aria-hidden="false"></i>')
                        $('#num-bookmarked').html('<strong>' + savedRecords.length + '</strong>');
                    } else {
                        var unbookmarkThis = $(this).attr('id').replace('remove-bookmark-', '');
                        var unbookmarkIndex = savedRecords.indexOf(unbookmarkThis);
                        if (unbookmarkIndex > -1) {
                            savedRecords.splice(unbookmarkIndex, 1);
                        }
                        $(this).removeClass('remove-bookmark');
                        $(this).addClass('add-bookmark');
                        $(this).attr('id', ('add-bookmark-' + unbookmarkThis));
                        $(this).html('<i class="fa fa-lg fa-bookmark-o" aria-hidden="false"></i>')
                        $('#num-bookmarked').html('<strong>' + savedRecords.length + '</strong>');
                    }
                    
                });

            
            /////////////////////////////////////////////////
            // click on info icon, get modal with attrs    //
            /////////////////////////////////////////////////

                $('.attr-modal-link').on('click', function(){
                    
                    // what record are we currently looking at? use the assigned id to figure it out
                    var featureToLookup = ($(this).attr('id')).replace('info-', '');
                    
                    // get the properties for the record
                    var geodexAttrQuery = L.esri.query({
                        url: mapService
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
                            var tableRowHtml = ( '<tr><td><strong>' + currentAttribute + '</strong></td><td>' + currentValue + '</td></tr>' );
                            
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

    $('#attrModal').on('hide.bs.modal', function(){
        
        $('#attr-table-1>tbody').empty();
        $('#attr-table-2>tbody').empty();
        
    });
    
/////////////////////////////////////////////////
// sql query creation function                 //
/////////////////////////////////////////////////

    function makesqlQuery() {
        
        // this variable will (temporarily) hold the sql query used to search the map service
        var query = '';
        
        // begin by looking at user year selections
        var fromThisYear = $('#years-from').val();
        var toThisYear = $('#years-to').val();
        query += ('DATE >= ' + fromThisYear + ' AND DATE <= ' + toThisYear);
        
        // then see if user as selected any series
        if (searchTheseSeries.length > 0){
            var charsStripped = searchTheseSeries.replace("'", "''");
            query += (" AND SERIES_TIT = '" + charsStripped + "'");
        }

        // and finally...
        return query;
        
    }