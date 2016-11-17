var savedRecords = []; // this array will store any records the user has chosen to "bookmark"
var searchTheseSeries = []; // this array will store the series that the user wishes to search
var mapService = 'http://webgis.uwm.edu/arcgisuwm/rest/services/AGSL/GeodexWebMapService/MapServer/0'; // the url for our map service; will be referenced in a lot of places
var tableExportVisible = false; // are the saved record export buttons visible?

// when document is ready...
$(document).ready(function(){
    makeTheMap(); //... render the map
    
    // hide Results and Saved Records divs
    $('#bookmarks').hide();
    $('#search-results').hide();
    
    // hide "Exclude large maps..." option by default...
    $('#exclude-large-area-toggle').hide();
    // ...and show it when the user selects "intersects" method
    $('.extent-radio').on('change', function(){
        if ($('#search-intersect').prop('checked')){
            $('#exclude-large-area-toggle').show();
        } else {
            $('#exclude-large-area-toggle').hide();
            $('#exclude-large-maps').prop('checked', false);
        }
    });
    
    /////////////////////////////////////////////////
    // navigation tabs                             //
    /////////////////////////////////////////////////
    
        // eventually want to re-write this
    
        function showTab(tabToShow) {
            if (tabToShow === 'saved'){
                $('#search-parameters').hide();
                $('#search-results').hide();
                $('#bookmarks').show();
            } else if (tabToShow === 'results') {
                $('#search-parameters').hide();
                $('#bookmarks').hide();
                $('#search-results').show();
            } else if (tabToShow === 'search') {
                $('#bookmarks').hide();
                $('#search-results').hide();
                $('#search-parameters').show();
            }
        }
    
        $('#tab-saved').on('click', function(){
            showTab('saved');
        });
        $('#tab-results').on('click', function(){
            showTab('results');
        });
        $('#tab-search').on('click', function(){
            showTab('search');
        });
    
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
        $('#years-to #' + currentYear).prop('selected', true);
        
        
        // Give users an alert message if their chosen year range is invaild
        $('#years-from').change(function(){ validateYears(); });
        $('#years-to').change(function(){ validateYears(); });
        function validateYears() {
            var x = $('#years-from').val();
            var y = $('#years-to').val();
            if (x > y){
                $('#years-not-in-order').show();
            } else {
                $('#years-not-in-order').hide();
            }
        }
        
        // Reset years to default
        $('#reset-years').on('click', function(){
            $('#years-from option:first').prop('selected', true);
            $('#years-to option:last').prop('selected', true);
            $('#years-not-in-order').hide();
        });
        
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
            $('#series-list').on('click', function(){
                $('#series-list option:first').prop('disabled', true);
            });
        }
        
        // when the user selects a new series for the query...
        $('#series-list').on('change', function(){
            var currentIndex = $(this).val();
            // if the series is not in the array already, add it to the list of series to search
            if (($.inArray(uniqueSeriesArray[currentIndex], searchTheseSeries)) === -1){
                searchTheseSeries.push(uniqueSeriesArray[currentIndex]);
                $('#series-to-be-searched').append('<span class="series-span" id="uniqueseries-' + currentIndex + '">' + uniqueSeriesArray[currentIndex] + ' <button type="button" class="close" aria-label="Close"><span aria-hidden="true">&times;</span></button></span>');
            }
            // when user clicks "x" next to series name, remove it from the array
            $('.series-span .close').off();
            $('.series-span .close').on('click', function(){
                var parentElement = $(this).parent();
                var seriesToRemoveIndex = $(parentElement).attr('id').replace('uniqueseries-', '');
                var seriesToRemove = uniqueSeriesArray[seriesToRemoveIndex];
                var searchSeriesIndex = searchTheseSeries.indexOf(seriesToRemove);
                searchTheseSeries.splice(searchSeriesIndex, 1);
                $(parentElement).remove();
            });
        });
});

/////////////////////////////////////////////////
// map rendering!                              //
// (pretty much all map-related stuff)         //
/////////////////////////////////////////////////

    function makeTheMap() {
        
        // initialize the map
        var theMap = L.map('map') // draw the map in the element with an id of "map"
            .setView([41.621602, -43.637695], // by default, center to area between Iberian Peninsula and Nova Scotia
            4) // ...with a zoom level of 4
            .setMaxBounds([ // with this method, the map will "bounce" back once the user hits the map boundary
                [-180, -180], // this is because esri-leaflet querying gets confused otherwise
                [180, 180]
            ]);
            
        // put current zoom level in "Exclude large maps relative to current zoom level" option
        $('#current-zoom-level').html(theMap.getZoom());
        
            
        // this variable holds the minimum zoom level needed to activate "search current extent" button
        var minExtentZoom = 1;
            
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
                    $('#search-geodex-button').prop('disabled', '');
                } else { // otherwise, disable it
                    $('#search-geodex-button').prop('disabled', 'disabled');
                }
                $('#current-zoom-level').html(currentZoom);
            });
        
        /////////////////////////////////////////////////
        // search                                      //
        /////////////////////////////////////////////////
        
            $('#search-geodex-button').on('click', function(){ // when the user clicks the "search current extent" button...
            
            var currentMapBounds = theMap.getBounds(); // ...get the boundaries of the current map extent...
            var sw = currentMapBounds._southWest; // assign the southwest boundary to a variable
            var ne = currentMapBounds._northEast; // assign the northeast boundary to a variable
            var queryBounds = L.latLngBounds(sw, ne); // combine the boundaries into a leaflet latlong object
                
                var sqlQuery = makesqlQuery();
                
                var geodexSearchQuery = L.esri.query({
                    url: mapService
                });
                
                if ($('#search-intersect').prop('checked')) {
                    geodexSearchQuery.intersects(queryBounds)
                    .where(sqlQuery);
                } else if ($('#search-within').prop('checked')){
                    geodexSearchQuery.within(queryBounds)
                    .where(sqlQuery);
                } else if ($('#no-search-extent').prop('checked')){
                    geodexSearchQuery.where(sqlQuery);
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

                $('#num-results').html(s.length);
                    
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
                        
                        var loc = s[h].properties.LOCATION;
                        var date = s[h].properties.DATE;
                        var rec = s[h].properties.RECORD;
                        var oid = s[h].properties.OBJECTID;
                        var ser = s[h].properties.SERIES_TIT;
                        
                        if (loc === null){
                            loc = '';
                        } else {
                            loc = ': ' + loc;
                        }
                        
                        if (cat === ser) {
                            listToReturn += ('<li class="list-group-item"><a href="#" class="show-map-outline-link" id="show-outline-' + oid +'"><i class="fa fa-lg fa-map" aria-hidden="true"></i></a><a href="#" class="attr-modal-link" id="info-' + oid + '" data-toggle="modal" data-target="#attrModal"><i class="fa fa-lg fa-info-circle aria-hidden="false"></i></a><span class="search-result">' + date + ' &ndash; ' + rec + loc + '</span>');
                            listToReturn += searchResultsBookmarkDetermine(oid.toString());
                            listToReturn += '</li>';
                        } else if (cat === "No associated series" && ser === null) { // need this to deal with series containing a null value
                            listToReturn += ('<li class="list-group-item"><a href="#" class="show-map-outline-link" id="show-outline-' + oid +'"><i class="fa fa-lg fa-map" aria-hidden="true"></i></a><a href="#" class="attr-modal-link" id="info-' + oid + '" data-toggle="modal" data-target="#attrModal"><i class="fa fa-lg fa-info-circle aria-hidden="false"></i></a><span class="search-result">' + date + ' &ndash; ' + rec + loc + '</span>');
                            listToReturn += searchResultsBookmarkDetermine(oid.toString());
                            listToReturn += '</li>';
  
                        }
                    }
                    return listToReturn;
                }
                
                function searchResultsBookmarkDetermine (q) {
                    if (savedRecords.indexOf(q) >= 0){
                        return ('<a href="#" class="bookmark-link remove-bookmark" id="remove-bookmark-' + q + '"><i class="fa fa-lg fa-bookmark" aria-hidden="false"></i></a>')
                    } else {
                        return ('<a href="#" class="bookmark-link add-bookmark" id="add-bookmark-' + q + '"><i class="fa fa-lg fa-bookmark-o" aria-hidden="false"></i></a>')
                    }
                }
                
                $('#search-results').html( // once everything else is done, change the "search-results" div's html to match that of the resultsHtml variable
                    resultsHtml
                )
                .promise()
                .done(function(){
                    $('#tab-results').click();
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
                    var containTest = currentExtent.contains(thisFeaturesGeometry); // returns true if outline is in current extent, false if not
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
                        $('#no-saved-records').empty();
                        var bookmarkThis = $(this).attr('id').replace('add-bookmark-', '');
                        savedRecords.push(bookmarkThis);
                        $(this).removeClass('add-bookmark');
                        $(this).addClass('remove-bookmark');
                        $(this).attr('id', ('remove-bookmark-' + bookmarkThis));
                        $(this).html('<i class="fa fa-lg fa-bookmark" aria-hidden="false"></i>')
                        $('#num-bookmarked').html(savedRecords.length);
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
                        $('#num-bookmarked').html(savedRecords.length);
                    }
                    
                    updateRecordsList();
                    
                });
                
            /////////////////////////////////////////////////
            // saved records display function              //
            /////////////////////////////////////////////////
            
                function updateRecordsList() {
                    
                    createExportTable();
                    
                    var exportTable = $('#export-table').tableExport();
                    
                    // generate <li>s
                    var bookmarksHtml = '';
                    for (w = 0; w < savedRecords.length; w++) {
                        bookmarksHtml += ('<li>' + savedRecords[w] + '</li>');
                    }
                    
                    $('#saved-records-list').html(bookmarksHtml);
                }
                
            /////////////////////////////////////////////////
            // export table                                //
            /////////////////////////////////////////////////
                    
                function createExportTable(){
                    
                    $('#export-table').empty();
                    
                    //to change which attributes appear in the exported Excel file, simply update this array!
                    var exportTableAttributes = ['OBJECTID', 'DATE', 'CATLOC'];
                
                    // create the table head
                    var exportTableHtml = '<thead><tr>';
                    for (w = 0; w < exportTableAttributes.length; w++) {
                        exportTableHtml += ('<td>' + exportTableAttributes[w] + '</td>');
                    }
                    exportTableHtml += '</tr></thead><tbody>';
                   
                    // to create the table body, we must query all of the saved records
                    var exportTableQuery = L.esri.query({
                        url: mapService
                    });
                    
                    // loop through all of the saved records to create an sql query
                    var exportTableSql = '';
                    for(u = 0; u < savedRecords.length; u++) {
                        exportTableSql += ('OBJECTID = ' + savedRecords[u]);
                        if (u !== (savedRecords.length - 1)){
                            exportTableSql += ' OR ';
                        }
                    }

                    // run the sql query we just made
                    exportTableQuery.where(exportTableSql).fields(exportTableAttributes).returnGeometry(false);
                    exportTableQuery.run(function(error, sqlResult, response){
                        // now use the query results to create the table body
                        for(n = 0; n < sqlResult.features.length; n++) {
                            exportTableHtml += '<tr>'
                                for(m = 0; m < exportTableAttributes.length; m++){
                                    var getThisAttr = exportTableAttributes[m];
                                    exportTableHtml += ('<td>' + sqlResult.features[n].properties[getThisAttr] + '</td>');
                                }
                            exportTableHtml += '</tr>'
                            if (n === (sqlResult.features.length -1)) {
                                exportTableHtml += '</tbody>';
                                $('#export-table').html(exportTableHtml);
                            }
                        }
                        $('#export-table').tableExport({
                            fileName: 'geodexrecords',
                            formats: ['xls']
                        });
                    });
                   
                }

            /////////////////////////////////////////////////
            // attribute table vocabulary                  //
            /////////////////////////////////////////////////
                
                // these domains are used in multiple attributes; might as well store them separately
                var yearTypeDomain = {
                    "97" : "Approximate Date",
                    "98" : "Publication Date",
                    "99" : "Compilation Date",
                    "100" : "Base Map Date",
                    "102" : "Field Checked",
                    "103" : "Image Year",
                    "104" : "Photography to",
                    "105" : "Photo Inspected",
                    "106" : "Image Date",
                    "108" : "Preliminary Edition",
                    "109" : "Compiled From Map Dated",
                    "110" : "Interim Edition",
                    "112" : "Printed",
                    "113" : "Printed Circa",
                    "114" : "Revised",
                    "115" : "Situation/Survey",
                    "116" : "Transportation Network",
                    "118" : "Provisional Edition",
                    "120" : "Photo Revised",
                    "121" : "Edition of",
                    "119" : "Magnetic Declination Year"
                };
                
                var subsDomain = {
                    "0": "Not assigned",
                    "1": "Global Coverage",
                    "2": "Regional Coverage",
                    "3": "Nautical, Aeronautical, and Lake Charts",
                    "4": "USGS Topographic Quads"
                };
                
                /*
                maintaining the structure of this is very important!
                    - each attribute that needs changing (or has values that need changing) is a key in the valuesVocab object
                    - the value for the key is one array that should not exceed two values
                    - the first value in the array is the new name for the attribute
                    - the second value is the array is an object containing definitions for individual values -- this is OPTIONAL
                    - attributes can be left out of this object entirely to maintain their default attribute names/value names
                */
                
                var valuesVocab = {
                    "CATLOC" : ["Catalog Location"],
                    "DATE" : ["Date"],
                    "EDITION_NO" : ["Edition Number"],
                    "GDX_FILE" : ["GDX Series"],
                    "GDX_NUM" : ["GDX File Number"],
                    "GDX_SUB" : ["GDX Subtype", subsDomain],
                    "HOLD" : ["Holdings"],
                    "ISO_TYPE" : ["Isobar Type", {
                        "1" : "Isobars Feet",
                        "2" : "Isobars Fathoms",
                        "3" : "Isobars Meters",
                        "4" : "Contours Feet",
                        "5" : "Contours Meters",
                        "6" : "Multiple Isobar Types",
                        "7" : "No Isobar Indicated"
                    }],
                    "ISO_VAL" : ["Isobar Value"],
                    "LAT_DIMEN" : ["Latitude Dimension"],
                    "LOCATION" : ["Location"],
                    "LON_DIMEN" : ["Latitude Dimension"],
                    "MAP_FOR" : ["Map Format", {
                        "0" : "Not assigned",
                        "211" : "180° Longitude X-over entry",
                        "212" : "180° Longitude X-over entry",
                        "47" : "County format",
                        "998" : "Geologic map",
                        "50" : "Inset on quad",
                        "48" : "Irregular format",
                        "996" : "Printed map - 2 color",
                        "995" : "Printed map - colored",
                        "42" : "Quad not entirely mapped",
                        "49" : "Quad with inset",
                        "45" : "Special quadrangle",
                        "41" : "Standard quadrangle",
                        "44" : "Std quad with extensions",
                        "43" : "Std quad with overlap"
                    }],
                    "MAP_TYPE" : ["Map Type", {
                        "0" : "Not assigned",
                        "30" : "Administrative map",
                        "1" : "Aerial photograph",
                        "6" : "Aeronautical chart",
                        "7" : "Bathymetric map",
                        "21" : "Coal map",
                        "5" : "Geologic map",
                        "4" : "Hydrogeologic map",
                        "11" : "Land use map",
                        "12" : "Nautical chart",
                        "13" : "Orthophoto map",
                        "14" : "Planimetric map",
                        "998" : "Printed map - 2 color",
                        "997" : "Printed map - colored",
                        "996" : "Printed map - monochrome",
                        "995" : "Projection not indicated",
                        "15" : "Reference map",
                        "16" : "Road map",
                        "22" : "Satellite image map",
                        "24" : "Shaded relief map",
                        "18" : "Topo map (contours)",
                        "23" : "Topo map (form lines)",
                        "19" : "Topo map (hachures)",
                        "25" : "Topo map (irr interval)",
                        "20" : "Topo map (layer tints)"
                    }],
                    "PRIME_MER" : ["Prime Meridian", {
                        "0" : "Not assigned",
                        "157" : "Athens PM",
                        "999" : "C¢rdoba PM", // is this correct?
                        "148" : "Copenhagen PM",
                        "135" : "Ferro PM",
                        "131" : "Greenwich PM",
                        "132" : "Madrid PM",
                        "146" : "Munich PM",
                        "142" : "Paris PM",
                        "138" : "Quito PM",
                        "147" : "Rome PM"
                    }],
                    "PROJECT" : ["Projection", {
                        "0": "Not assigned",
                        "163" : "Azimuthal equidistant",
                        "185" : "Bonne",
                        "199" : "Cassini",
                        "182" : "Conic equidistant",
                        "183" : "Conic",
                        "171" : "Cylindrical",
                        "180" : "Gauss-Krüger",
                        "999" : "Gauss-Krüger",
                        "164" : "Gnomonic",
                        "186" : "Lambert conformal conic",
                        "175" : "Mercator",
                        "176" : "Miller",
                        "998" : "Munich PM",
                        "187" : "Polyconic",
                        "198" : "Polyhedric",
                        "161" : "Not indicated",
                        "178" : "Sinusoidal",
                        "168" : "Stereographic",
                        "179" : "Transverse Mercator"
                    }],
                    "PRODUCTION" : ["Production", {
                        "0" : "Not assigned",
                        "38" : "Blue line print",
                        "39" : "Blueprint",
                        "37" : "Negative microform",
                        "35" : "Negative photocopy",
                        "34" : "Positive photocopy",
                        "32" : "Printed map - 2 color",
                        "31" : "Printed map - colored",
                        "33" : "Printed map - monochrome"
                    }],
                    "PUBLISHER" : ["Publisher"],
                    "RECORD" : ["Record"],
                    "RUN_DATE" : ["Run Date"],
                    "SCALE" : ["Scale"],
                    "SERIES_TIT" : ["Series"],
                    "Shape_Area" : ["GIS Shape Area"],
                    "Shape_Length" : ["GIS Shape Length"],
                    "X1" : ["West"],
                    "X2" : ["East"],
                    "Y1" : ["North"],
                    "Y2" : ["South"],
                    "YEAR1_TYPE" : ["Year 1 Type", yearTypeDomain],
                    "YEAR1" : ["Year 1"],
                    "YEAR2_TYPE" : ["Year 2 Type", yearTypeDomain],
                    "YEAR2" : ["Year 2"],
                    "YEAR3_TYPE" : ["Year 3 Type", yearTypeDomain],
                    "YEAR3" : ["Year 3"],
                    "YEAR4_TYPE" : ["Year 4 Type", yearTypeDomain],
                    "YEAR4" : ["Year 4"]
                };
            
            
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
                            
                            // check to see if this attribute is in "valuesVocab" above; change the vocabulary if so
                            if(currentAttribute in valuesVocab){
                                if (valuesVocab[currentAttribute].length > 1){ // see if the attribute has value vocab first
                                    currentValue = valuesVocab[currentAttribute][1][currentValue];
                                }
                                currentAttribute = valuesVocab[currentAttribute][0];
                            }
                            
                            // generate the html for the secondary attributes
                            var tableRowHtml;
                            if (currentAttribute === "NautChartID" || currentAttribute === "OBJECTID"){
                                // do nothing
                            } else if (currentValue === null || currentValue === "Not assigned" || currentValue === undefined){ // color these values differently
                                tableRowHtml = ( '<tr><td><strong>' + currentAttribute + '</strong></td><td><span class="null-value">Not assigned</span></td></tr>' );
                                if (b === 0 || b <= ((attrKeys.length / 2) - 1)) { // throw the first half of all attributes in table #1
                                    $('#attr-table-1>tbody').append(tableRowHtml);
                                } else  { // throw the rest in table #2
                                    $('#attr-table-2>tbody').append(tableRowHtml);
                                }
                            } else {
                                tableRowHtml = ( '<tr><td><strong>' + currentAttribute + '</strong></td><td>' + currentValue + '</td></tr>' );
                                if (b === 0 || b <= ((attrKeys.length / 2) - 1)) { // throw the first half of all attributes in table #1
                                    $('#attr-table-1>tbody').append(tableRowHtml);
                                } else  { // throw the rest in table #2
                                    $('#attr-table-2>tbody').append(tableRowHtml);
                                }
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
            // var charsStripped = searchTheseSeries.replace("'", "''");
            query += ' AND ( ';
            for (w = 0; w < searchTheseSeries.length; w++){
                var charsStripped = searchTheseSeries[w].replace("'", "''");
                query += ("SERIES_TIT = '" + charsStripped + "'")
                if (w < (searchTheseSeries.length - 1)){
                    query += ' OR ';
                } else {
                    query += ' )';
                }
            }
        }
        
        // and finally...
        console.log(query);
        return query;
        
    }