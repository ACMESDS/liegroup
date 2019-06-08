// UNCLASSIFIED

const {Copy,Log} = require("../enum");
		
/*
var LG = module.exports = {	
	points: 4, // default number of points
	
	config: function (opts, cb) {
		
		if (opts) Copy(opts,LG);
		
		return new GROUP(LG.points);
	}
};  */

function $(N, cb) {
	var A = new Array(N);
	if (cb) for (var n=0; n<N; n++) cb( n,A );
	return A;
}

[ 
	function $(cb) {
		for (var n=0, N=this.length; n<N; n++) cb( n, this );
		return this;
	}
].Extend(Array);
	
var LG = module.exports = {
	group: GROUP,
	
	// Provide imaging methods
	
	image: function(X, M) {
	// Return supplied KxK image string X centered in an image A of M^2 entries..
	
		var A = new Array(M*M);

		for (var n=0,N=A.length; n<N; n++) A[n] = 0;

		for (var n=1,K=0, N=X.length; n<N; n++,K++)
			if ( X.charAt(n) == "\n" ) break;
		
		var pad = (M-K)/2;	// left, right, top, bottom padding
		
		//Log({K: K, pad: pad});
		
		for (var n=1, N=X.length, m=pad*M+pad; n<N; n++) {
			if ( (x = X.charAt(n)) == "\n" ) 
				m += 2*pad;
			
			else 
				A[m++] = parseInt(x);
		}

		//Log({image: A});
		//for (var m=0; m<A.length; m++) Log(m,A[m]);
		
		return A;
	},
	
	pairs: function (M, rho) {
	/*
	Pair (xm,ym) by reflecting xm about (alpha,beta)-line lying in NxN image.
	*/
		const {round, floor,PI,cos,sin,sqrt} = Math;
		
		var 
			N = round( sqrt(M) ),	// image A is M^2 = NxN
			M2 = floor((M-N)/2)+N, 		// number of pairs in image A
			N2 = (N-1)/2,

			alpha = cos(rho * PI/180), // line of reflection symmetry
			beta = sin(rho * PI/180);
		
		return $(M, (n, P) => {
			var
				xm = n,
				x0 = [ floor(xm / N), xm % N ],  // start [image row col]
				x = [ x0[0]-N2, x0[1]-N2 ], 	// image location

				t = alpha * x[0] + beta * x[1],  // parametric parms
				u = beta * x[0] - alpha * x[1],

				y = [ alpha*t - beta*u, beta*t + alpha*u ],  // end image location
				y0 = [ round(y[0]+N2), round(y[1]+N2) ],

				ym = y0[0] * N + y0[1];
			
			P[n] = {x: xm, y: ym};
		});
	},
						
	scatter: function (A,rho,leg,cb) {
	/*
	Compute scattering of an image A about the rho symmetry from the named leg.  Each pair is 
	passed to the callback cb(pair) to compute its (+/-) scattering coefficients.  After all
	pairs are made, the computed scattering coefficients coff are passed to cb(coef, leg).
	*/
		const {round, floor, sqrt} = Math;
		
		var 
			M = A.length, N = round( sqrt(M) ),	// image A is NxN
			M2 = floor((M-N)/2)+N, 		// number of pairs in image A
			pairs = LG.pairs(M, rho),	// (x,y) pairs
			pos = "+", neg = "-",	// symbols +/- = sum/dif computed on this leg
			coef = { n: 0, map: $(M) };
			
		coef[pos] = $(M2);
		coef[neg] = $(M2);
		//Log( [rho, [M,N],[M2,N2],[alpha,beta] ] );

		pairs.forEach( pair => { // generate (x,y) image pairs from (x,y) pairs
			var
				img = { x: A[pair.x], y: A[pair.y] };
			
			if ( !coef.map[pair.x] ) {  // pair has not yet been connected
				coef.map[pair.x] = pair.y;  // map pair being connected
				coef.map[pair.y] = pair.x;

				if ( cb ) {  // cb computes the pair scattering symmetries (x,y)
					cb(img);

					coef[pos][coef.n] = img.x;
					coef[neg][coef.n] = img.y;
					coef.n++;
				}

				//Log([ x0, y0, coef.n, img ]);
			}
		});
		
		if (cb) {  // return symmetries to callback 
			cb( coef[pos] , leg + pos );
			cb( coef[neg] , leg + neg );
		}
	},
	
	haar: function haar(A,rho,depth,leg,cb) {
	/*
	Deep haar scatter image A about the rho symmetry to the 
	requested depth starting from the named leg.
	*/
			
		function recurse(A,depth,leg) { // pad image A to square and pass to haar
			const {round, sqrt, max, min} = Math;
			
			var
				M = A.length,
				pad = max(0, round( sqrt(M) )**2 - M),
				pads = new Array(pad);

			//Log(['pad',depth,leg,M,pad]);
			for (var n=0; n<pad; n++) pads[n] = 0;

			haar(A.concat(pads), rho, depth, leg, cb);
		}

		const {abs} = Math;
		
		LG.scatter(A, rho, leg, function (pair, leg) { 	// get scattering symmetries

			if (pair.constructor == Array)   // image so recurse down haar tree
				if (depth)  							// recurse to next depth
					recurse( pair , depth-1, leg);

				else  									// callback with scatterings
					cb( pair , leg );
			
			else {  // pair so compute its haar scattering
				var x = pair.x, y = pair.y;
				
				pair.x = x+y;
				pair.y = abs(x-y);
			}

		});
	}
}

function GROUP(N) {	// N-point group generator
/*
	Generate the 2N symmetries of an N-point group G.  For every g in G
 
		G[g] = point permutation [1:N]

	where the permutators H of G

		H[g] = op(arg , point perm)

	have arguments A

		A[g] = 0 ... K

	For N = 4 points, for example, there are 8 elements in the group G: 3 rotators
	(r1, r2, r3), 2 flippers (f0, f1), 2 mirrors (m0, m1) and an identity (e).  Here
	arguments A = [3, 2, 2, 0].  

	Also generates products P for f,g,h in group G

		P[ f * g ] = h

	inverses I

		f * I[ f ] = e

	involutes V

		V[ f ] * V[f] = e

	and equivalency-tests X

		X[ h ][ f*g ] = true if f*g = h	
	*/
	 
	function rot(i,x) {  // rotation permutation
		var rtn = new Array(N);
		for (var n=0; n<N; n++)
			rtn[n] = x[ (N-i+n) % N ];
		return rtn;
	}

	function mirror(i,x) {  // mirror permutation
		var rtn = new Array(N);
		rtn[i] = x[i];
		i += N2;
		rtn[i] = x[i];
		for (var n=0, iL=i-1, iR=(i+1)%N, N1=N2-1; n<N1; n++,iL--,iR=(iR+1)%N) {
			rtn[iL] = x[iR];
			rtn[iR] = x[iL];
		}
		return rtn;
	}

	function swap(i,x) { // swap permutation
		var rtn = new Array(N);
		rtn[i] = x[i];
		for (var n=1,iL=(N+i-n)%N,iR=(i+n)%N; n<=N2; n++,iL=(N+i-n)%N,iR=(i+n)%N) {
			rtn[iL] = x[iR];
			rtn[iR] = x[iL];
		}
		return rtn;
	}

	function flip(i,x) { // flip permuation
		var rtn = new Array(N);
		for (var n=0,iL=i,iR=i+1,iN=i+1; n<iN; n++,iL--,iR++) {
			rtn[iL] = x[iR];
			rtn[iR] = x[iL];
		}
		i += N2;
		for (var n=0,iL=i,iR=i+1,iN=N-i-1; n<iN; n++,iL--,iR++) {
			rtn[iL] = x[iR];
			rtn[iR] = x[iL];
		}
		return rtn;
	}

	function ident(i,x) { // identity permutation
		return x;
	}

	function eq(x,y) { // test permuations are equal
		for (var n=0;n<N;n++)
			if (x[n] != y[n]) return false;

		return true;
	}

	function find(x, cb) { // find permuation and pass to callback
		for (var h in G)
				if ( eq(x, G[h]) )
					return cb(h);

		Log("Houston we have a problem - G is not a group!");
	}

	function index(k) {
		k = k || 1;
		var rtn = new Array(N);
		for (var n=0; n<N; n++) rtn[n] = n*k;
		return rtn;
	}

	var 
		G = this.G = {},
		H = this.H = {},
		P = this.P = {},
		X = this.X = {},
		I = this.I = {},
		A = this.A = {},
		V = this.V = [],
		C = this.C = [{e:0}],
		odd = this.odd = (N % 2) ? true : false,
		even = this.even = ! this.odd,
		e = G.e = [],
		rho =  this.rho = index(180/N),
		order = this.order = 2*N,
		sym = this.sym = { // symmetry labels
			std: {},
			fav: {
				f0: "h",	// flip
				f1: "v",
				m0: "m",	// mirror
				n0: "n"	// rotation
			}
		},
		N2 = even ? N/2 : (N-1)/2;

	this.moves = {flips:even?N:0, mirrors:even?N-2:0, swaps:odd?N:0};

	for (var n=1;n<=N;n++) e.push(n); H[g="e"] = ident; A[g] = 0;  // H[g] = op(arg,perm)

	for (var n=1;n<N;n++) G[g="r"+n] = (H[g]=rot)(A[g]=n,e);  // G[g] = perm

	if (even) {
		for (var n=0; n<N2; n++) G[g="f"+n] = (H[g]=flip)(A[g]=n,e);
		for (var n=0; n<N2; n++) G[g="m"+n] = (H[g]=mirror)(A[g]=n,e);
	}

	else
		for (var n=0; n<N; n++) G[g="s"+n] = (H[g]=swap)(A[g]=n,e);

	for (var f in G) for (var g in G)
		find( fg = H[g](A[g], G[f]), h => {
			if (h == "e") {					// if h = identity returned
				I[f] = g; I[g] = f;				// save inverses  f * I[ f ] = e
				if (f == g) V.push(f);		// save involutes V[ f ] * V[ f ] = e
			}

			P[fg = f+"*"+g] = h; 	// save products f*g = h

			if (! X[h] ) X[h] = {}; 	// reserve for tests 
			X[h][fg] = (f[0] != "r" && g[0] != "r") ? true : false;  // save X[ h ][ f*g ] true if f*g = h
		});  // H[g] = PermOp(arg, perm)

	// Generate conjugacy classes C.

	for (var f in G) for (var g in G) if (f != "e" && g != "e") {
		var _g = I[g], _gf = P[_g+"*"+f], _gfg = H[g](A[g], G[_gf]);

		find(_gfg, function (h) {
			for (var k=0, K=C.length; k<K; k++)
				if ( C[k][f] ) return C[k][h]=k;
				//else
				//if (C[k][h] ) return C[k][f]=k;

			C.push( {} );
			C[K][f] = C[K][h] = K+1;
		});
	}
}

switch ( process.argv[2] ) { //< unit tests
	case "L1":
	/*7811
	6921
	5431
	2222
	*/
		var 
			G = new GROUP(4),
			Uset = {},
			A = LG.image(`
1789
1234
4321
6543
`, 16);		// 16x16 image from string

		//Log(A);

		LG.haar( A,	G.rho[1], 3 , "", function (S,leg) {

			function dot(a,b) {
				var
					sum = 0;
				
				for (var n=0, N=a.length; n<N; n++) sum += a[n] * b[n];
				return sum;
			}

			function proj(u,v) {
				return scale( copy(u), - dot(v, u) / dot(u, u) );
			}

			function scale(u,a) {
				/*
				if (v.constructor == Array)
					for (var n=0, N=u.length; n<N; n++) u[n] = v[n] * u[n];
				else
					for (var n=0, N=u.length; n<N; n++) u[n] = v * u[n];

				return u; */
				return u.$( (n,u) => u[n] *= a );
			}

			function add(u,v) {
				/*if (v.constructor == Array)
					for (var n=0, N=u.length; n<N; n++) u[n] = u[n] + v[n];
				else
					for (var n=0, N=u.length; n<N; n++) u[n] = u[n] + v;

				return u;*/
				return u.$( (n,u) => u[n] += v[n] );
			}

			function copy(u) {
				//return init(new Array(u.length), u);
				return $(u.length, (n,x) => x[n] = u[n] );
			}

			/*
			function init(u,a) {
				if (a.constructor == Array)
					for (var n=0, N=u.length; n<N; n++) u[n] = a[n];
				else
					for (var n=0, N=u.length; n<N; n++) u[n] = a;

				return u;
			}*/

			function gs(v, us) {
				var  u = copy(v);

				for (var n in us) 
					if ( allZero( add(u, proj(us[n], v)) ) ) {
						//Log(["drop "+n, v]);
						return null;
					}

				return u;
			}

			function allZero(u) {	
				const {abs} = Math;
				
				for (var n=0, N=u.length; n<N; n++)
					if ( abs(u[n]) > 1e-3 ) 
						return false;

				return true;
			}

			//Log([leg, S]);

			if (false) 
				Uset[leg] = copy(S);

			else
			if (u = gs(S, Uset)) 
				Uset[leg] = copy(u);

		});

		//Log(Uset);
		for (var n in Uset) Log(n);
/* 
for this image, should produce the 5x5 disparity map:

		++++
		+++-
		++-+
		+-++
		-+++

where +/- denotes sum/dif scattering calculation along each leg of 
the scattering.  Here only 5 legs were significant enough to be retained.
*/
		break;
}

// UNCLASSIFIED
				   