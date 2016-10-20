// page breaks in IE without this line
document.createElement('main');

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
            6); // ... with a zoom level of 6
            
        // add basemap: currently OpenStreetMap.Mapnik
        var basemapLayer = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            minZoom: 4,
            maxZoom: 19,
            attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'}); 
        basemapLayer.addTo(theMap);
        
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
                data.feature.properties);
        });
        
    }