//////////////////////////////////////////////////
// the global Geodex object			   			//
//////////////////////////////////////////////////

	var Geodex = {
		
		initialize: function() {
			var theMap; // has to be declared here because of all the methods that use it
			this.years.populate();
			this.series.getAll();
			this.map.initialize();
		},
		
		//=====================================================//
		
		years: {
			min: 1829, // minimum year for the "years" dropdown
			max: new Date().getFullYear(), // maximum year for the "years" dropdown
			populate: function () { // method to populate drop-downs with all years between min and max
				var dropdownYearsList;
				for (var i = this.min; i <= this.max; i++){
					dropdownYearsList += ('<option value="' + i + '" id="' + i +'">' + i + '</option>');
				}
				$('#years-from').html(dropdownYearsList);
				$('#years-to').html(dropdownYearsList);
				$('#years-to #' + this.max).prop('selected', true);
			},
			validate: function () { // when user selects a year, let her know if date range is invalid
				var fromYear = $('#years-from').val();
				var toYear = $('#years-to').val();
				if (fromYear > toYear) {
					$('#years-not-in-order').show();
				} else {
					$('#years-not-in-order').hide();
				}
			},
			toDefault: function () { // when user clicks "reset years" link, go back to default date range (min to max)
				$('#years-from option:first').prop('selected', true);
				$('#years-to option:last').prop('selected', true);
				$('#years-not-in-order').hide();
			}
		},
		
		//=====================================================//
		
		series: {
			field: 'SERIES_TIT', // attribute table field name for the series
			array: [], // array to hold all of the series, populated with fillArray method
			maximumSeriesLength: 65, // number of characters to display in the series dropdown before cutting off
			getAll: function () { // this method will populate Geodex.series.array; see https://github.com/Esri/esri-leaflet/issues/880
				query = L.esri.query({
					url: Geodex.map.service
				})
				.where('1=1')
				.returnGeometry(false)
				.fields(this.field);
				query.params.returnDistinctValues = true;
				query.run(function(error, results, response) {
					$.each(results.features, function (i, v){
						if (v.properties[Geodex.series.field] !== null){
							Geodex.series.array.push(v.properties[Geodex.series.field]);
						}
						if (i === results.features.length - 1){
							Geodex.series.array.sort();
							Geodex.series.populate();
						}
					});
				});
			},
			populate: function() { // populate the series drop-down (to be done after getAll)
				var seriesHtml = '<option value="series-none" id="series-none">No series selected</option>';
				$.each(Geodex.series.array, function (i, v){
					if (v.length >= Geodex.series.maximumSeriesLength) {
						seriesHtml += ('<option value="' + i + '" id="series-' + i +'">' + (v).substring(0, Geodex.series.maximumSeriesLength) + '...</option>');
					} else {
						seriesHtml += ('<option value="' + i + '" id="series-' + i +'">' + v + '</option>');
					}
				});
				$('#series-list').html(seriesHtml);
				$('#series-list').on('click', function(){
					$('#series-list option:first').prop('disabled', true);
				});
			},
			ifNull: 'No associated series'
		},
		
		//=====================================================//
		
		savedRecords : [], // records the user has saved
		
		//=====================================================//
		
		search : { // all of the search options available to the user
			series: [],
			addSeries: function(i) {
				if (($.inArray(Geodex.series.array[i], Geodex.search.series)) === -1) {
					Geodex.search.series.push(Geodex.series.array[i])
					$('#series-to-be-searched').append('<span class="series-span" id="uniqueseries-' + i + '">' + Geodex.series.array[i] + ' <button type="button" class="close" aria-label="Close"><span aria-hidden="true">&times;</span></button></span>');
					// add event listener for removeSeries
					$('.series-span .close').off();
					$('.series-span .close').click(function(){
						var par = $(this).parent();
						var idx = $(par).attr('id').replace('uniqueseries-', '');
						Geodex.search.removeSeries(par, idx);
					});
				};
			},
			removeSeries: function(p, i) {
				var index = this.series.indexOf(Geodex.series.array[i]);
				this.series.splice(index, 1);
				$(p).remove();
			},
			sql: function() {
				// look at years dropdown to determine date range
				var fromThisYear = $('#years-from').val();
				var toThisYear = $('#years-to').val();
				var query = ('DATE >= ' + fromThisYear + ' AND DATE <= ' + toThisYear);
				// has the user selected any series?
				if (Geodex.search.series.length > 0) {
					query += ' AND ( ';
					$.each(Geodex.search.series, function(i, v) {
						var s = v.replace("'", "''");
						query += ("SERIES_TIT = '" + v + "'");
						if (i < Geodex.search.series.length - 1) {
							query += ' OR ';
						} else {
							query += ' )';
						}
					});
				}
				console.log(query);
				return query;
			},
			go: function() {
				var geoSearch = true;
				if ($('#no-search-extent').prop('checked')) {
					geoSearch = false;
				}
				if(geoSearch) {
					var currentMapBounds = theMap.getBounds(); // get the boundaries of the current map extent
					var sw = currentMapBounds._southWest; // assign the southwest boundary to a variable
					var ne = currentMapBounds._northEast; // assign the northeast boundary to a variable
					var queryBounds = L.latLngBounds(sw, ne); // combine the boundaries into a leaflet latlong object
				}
				var sql = Geodex.search.sql();
				var search = L.esri.query({
                    url: Geodex.map.service
                });
				if ($('#search-intersect').prop('checked')) {
                    search.intersects(queryBounds)
                    .where(sql);
                } else if ($('#search-within').prop('checked')) {
                    search.within(queryBounds)
                    .where(sql);
                } else if ($('#no-search-extent').prop('checked')) {
                    search.where(sql);
                }
				search.run(function(error, results, response) {
					Geodex.search.displayResults(results.features);
				});
			},
			displayResults: function(s) {
				$('#num-results').html(s.length);
				if (s.length === 1000) {
                    alertHtml = this.alerts.tooMany;
                } else if (s.length > 100 && s.length < 1000) {
                    alertHtml = this.alerts.almostTooMany;
                } else {
                    alertHtml = '';
                }
				var resultsHtml = ('<h2>Seach Results</h2>' + alertHtml + '<p>' + 'Found <strong>' + s.length + '</strong> results in ');
				var seriesSort = []
				$.each(s, function(i, v) {
					if(seriesSort.indexOf(s[i].properties[Geodex.series.field]) < 0) {
						seriesSort.push(s[i].properties[Geodex.series.field]);
					}
					if (seriesSort.indexOf(null) >= 0)  {
						var index = seriesSort.indexOf(null);
						seriesSort[index] = Geodex.series.ifNull;
					}
				});
				resultsHtml += ('<strong>' + seriesSort.length + '</strong> series.</p>')
				$.each(seriesSort, function(i, v){
					resultsHtml += ('<h3>' + v + '</h3>' + '<ul class="list-group">' + Geodex.search.makeResultsList(seriesSort[i], s) + '</ul>')
				});
				$('#search-results').html(resultsHtml).promise().done(function(){
					$('.show-map-outline-link').off();
					$('.show-map-outline-link').click(function(){
						Geodex.map.showFeatureOutline($(this).attr('id').replace('show-outline-', ''))
					});
					$('#tab-results').click();
				});
			},
			makeResultsList: function(category, s) {
				var listToReturn = '';
				$.each(s, function(i, v){
					var loc = v.properties.LOCATION;
					var date = v.properties.DATE;
					var rec = v.properties.RECORD;
					var oid = v.properties.OBJECTID;
					var ser = v.properties.SERIES_TIT;
					
					if (loc === null) {
						loc = '';
					} else {
						loc = ': ' + loc;
					}
					
					if(category === ser  || (category === "No associated series" && ser === null)) {
						listToReturn += ('<li class="list-group-item"><a href="#" class="show-map-outline-link" id="show-outline-' + oid +'"><i class="fa fa-lg fa-map" aria-hidden="true"></i></a><a href="#" class="attr-modal-link" id="info-' + oid + '" data-toggle="modal" data-target="#attrModal"><i class="fa fa-lg fa-info-circle aria-hidden="false"></i></a><span class="search-result">' + date + ' &ndash; ' + rec + loc + '</span>');
						var checkBookmark = oid.toString();
						if (Geodex.savedRecords.indexOf(checkBookmark) >= 0) {
							listToReturn += ('<a href="#" class="bookmark-link remove-bookmark" id="remove-bookmark-' + checkBookmark + '"><i class="fa fa-lg fa-bookmark" aria-hidden="false"></i></a>');
						} else {
							listToReturn += ('<a href="#" class="bookmark-link add-bookmark" id="add-bookmark-' + checkBookmark + '"><i class="fa fa-lg fa-bookmark-o" aria-hidden="false"></i></a>');
						}
						listToReturn += '</li>';
					}
					
				});
				return listToReturn;
			},
			alerts: {
				maxResults: 1000,
				manyResults: 100, // triggers the "you may want to edit your search" alert
				tooMany: ('<div class="alert alert-danger" role="alert"><strong>Your search returned too many results. Only the first 1000 will be displayed below.</strong> Adjust your search parameters to return more specific records.</div>'),
				almostTooMany: ('<div class="alert alert-warning" role="alert"><strong>Your search returned more than 100 results.</strong> All of them are displayed below. You may wish to adjust your search parameters to return more specific records.</div>')
			}
		},
		
		//=====================================================//
		
		map: {
			service: 'http://webgis.uwm.edu/arcgisuwm/rest/services/AGSL/GeodexWebMapService/MapServer/0',
			defaultView: {
				coordinates: [41.621602, -43.637695],
				zoom: 4
			},
			maxBounds: [[-180, -180], [180, 180]],
			zoom: {
				min: 4,
				max: 19
			},
			basemaps: {
				defaultBasemap: 'Esri World Topographic Map',
				data: [
					{
						name: 'Esri World Topographic Map',
						layerUrl: 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
						attr: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community'
					},
					{
						name: 'Esri World Imagery',
						layerUrl: 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
						attr: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
					},
					{
						name: 'Esri World Street Map',
						layerUrl: 'http://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
						attr: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'
					},
					{
						name: 'OSM Mapnik',
						layerUrl: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
						attr: 'Basemap &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
					}
				],
				load: function() {
					var basemapsObject = {};
					$.each(Geodex.map.basemaps.data, function(i, v){
						basemapsObject[v.name] = (L.tileLayer(v.layerUrl, {
							minZoom: Geodex.map.zoom.min,
							maxZoom: Geodex.map.zoom.max,
							attribution: v.attr
						}))
					});
					(basemapsObject[Geodex.map.basemaps.defaultBasemap]).addTo(theMap);
					var basemapsControl = L.control.layers(basemapsObject).addTo(theMap);
				}
			},
			hasSearchResultOutline: false,
			zoomLock: true,
			panLock: false,
			initialize: function(){
				theMap = L.map('map')
					.setView(Geodex.map.defaultView.coordinates, Geodex.map.defaultView.zoom)
					.setMaxBounds(Geodex.map.maxBounds);
				Geodex.map.basemaps.load();
			},
			outlineColor: 'red',
			removeFeatureOutline: function() {
				temporaryLayerGroup.remove();
				Geodex.map.hasSearchResultOutline = false;
			},
			showFeatureOutline: function(featureId){
				if (Geodex.map.hasSearchResultOutline) {
					Geodex.map.removeFeatureOutline();
				}
				var boundsQuery = L.esri.query({
					url: Geodex.map.service
				})
				.where('"OBJECTID" = '+ featureId)
				.run(function(error, results, response){
					var thisFeaturesGeometry = results.features[0].geometry.coordinates[0];
					for (i = 0; i < thisFeaturesGeometry.length; i++) {
						thisFeaturesGeometry[i].reverse();
					}
					temporaryLayer = L.polygon(thisFeaturesGeometry, {color: Geodex.map.outlineColor});
					temporaryLayerGroup = L.layerGroup([temporaryLayer]);
					temporaryLayerGroup.addTo(theMap);
					if(Geodex.map.zoomLock && !Geodex.map.panLock) {
						var currentExtent = theMap.getBounds();
						var containTest = currentExtent.contains(thisFeaturesGeometry);
						if(!containTest) {
							var panToHere = temporaryLayer.getBounds().getCenter(); // if necessary, pan to the center of the outline
							theMap.panTo(panToHere, {
								animate: true
							});
						}
					}
					Geodex.map.hasSearchResultOutline = true;
				});
			}
		}
	}

//////////////////////////////////////////////////
// set everything up!							//
//////////////////////////////////////////////////

	Geodex.initialize();
	

//////////////////////////////////////////////////
// default global event listeners				//
//////////////////////////////////////////////////

	$('#years-from').change(function() {
		Geodex.years.validate();
	});
	
	$('#years-to').change(function() {
		Geodex.years.validate();
	});
	$('#reset-years').click(function(e) {
		e.preventDefault();
		Geodex.years.toDefault();
	});
	$('#series-list').change(function() {
		var i = $(this).val();
		Geodex.search.addSeries(i)
	});
	$('#search-geodex-button').click(function(e){
		e.preventDefault();
		Geodex.search.go();
	});