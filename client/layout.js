Layout = function(){


    this.autolayout = function()
    {

        //sets for nodes and edges
        var nodes = [];
        var links = [];

        //mapping between uris and nodes
        var nodes2uris = {};
        var uris2nodes = {};

        //radius between nodes
        var radius = 0;

        //for computing the centre of the nodes
        var centreX = 0;
        var centreY = 0;

        //keep track of the sources and targets for edges
        //there are edges between nodes and associations
        var edgeSource = {};
        var edgeTarget = {};

        var i = 0;
        for( var uri in __icons ){

            //ignore link iconsmoveEdgeHead
            var is_link = false;
            for (var edgeId in __edges){
                var edgeuri = __edgeId2linkuri(edgeId);
                if (edgeuri == uri){
                    is_link = true;
                    break;
                }
            }
            if (is_link){
                continue;
            }

            var icon = __icons[uri]['icon'];


            //get x and y, and add to the centre calculation
            var x = parseFloat(icon.getAttr('__x'));
            var y = parseFloat(icon.getAttr('__y'));

            centreX = centreX + x;
            centreY = centreY + y;

            //determine the maximum radius of a node
            var bbox = icon.getBBox();
            radius = Math.max(radius, bbox.width, bbox.height);

            //create the node
            var n = {index: i, x:x, y:y};
            nodes.push(n);

            //keep the mapping
            nodes2uris[n.index] = uri;
            uris2nodes[uri] = n.index;

            i = i + 1;
        }

        //find centre of the nodes for the layout
        centreX = centreX / nodes.length;
        centreY = centreY / nodes.length;


        //create the edges
        for (var edge in __edges){

        	var start = __edges[edge]['start'];
        	var end = __edges[edge]['end'];

        	var source = uris2nodes[start];
        	var target = uris2nodes[end];

            //associations are composed of two edges
            //so record the node IDs at either end
            //TODO: Replaceable with var linkIn = __edgeId2ends(edgeId)[0];?
        	if (source == undefined){
        	    edgeTarget[start] = target;
            }

        	if (target == undefined){
        	    edgeSource[end] = source;
            }
        }

        //for each association, create the link in the force graph
        for (var assoc in edgeSource) {

            var s = edgeSource[assoc];
            var t = edgeTarget[assoc];

            links.push({source: s, target: t});
        }


        //init the simulation
        var simulation = d3.forceSimulation(nodes)
            .force("charge", d3.forceManyBody().strength(10))
            .force("link", d3.forceLink(links).distance(20).strength(1).iterations(10))
        	.force("collide", d3.forceCollide(radius))
            .force("center", d3.forceCenter(centreX, centreY))
            ;

        //stop the simulation (as we're not visualizing it)
        simulation.stop();

        //progress the simulation
        for (var i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; ++i) {
            simulation.tick();
        }

        for (var i = 0; i < nodes.length; i++){

            var n = nodes[i];
            var uri = nodes2uris[n.index];


            var icon = __icons[uri]['icon'];
            var bbox = icon.getBBox();

            //restrict to stay in the canvas
            var x = (n.x > bbox.width)?n.x:bbox.width;
            var y = (n.y > bbox.height)?n.y:bbox.height;

            //move each icon
            //TODO: should move edges as well,
            //but moving the two nodes at each end of the edge
            //double moves the edge ends, with one overwriting
            //the other.
            //would have to break apart
            //functions in geometry_utils or query_response to be
            //able to move ends of edges independently
            __select([uri]);
            GeometryUtils.initSelectionTransformationPreviewOverlay(bbox.x,bbox.y);
		    GeometryUtils.previewSelectionTranslation(x, y);
		    GeometryUtils.transformSelection();

		    GeometryUtils.hideTransformationPreviewOverlay();
		    __select();
        }

     };

    return this;
}();