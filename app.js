import * as THREE from 'three';
import TWEEN from 'three/addons/libs/tween.module.js';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

// ---------------------------------------------------------------------
// CONFIG — fill these in from your own Google Sheet / Cloud Console
// ---------------------------------------------------------------------
const GOOGLE_CLIENT_ID = '581557013779-bafpacmfk7qtl52vvlj09agdd52876ti.apps.googleusercontent.com';
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvR949Z2v1nOBefbib2akseQOvtdSvHjNpofTPAAO-1M8IV6yCP2EC9lkb86QsLifCO4f4XcCQkduj/pub?gid=0&single=true&output=csv';

// ---------------------------------------------------------------------
// Header sizing
// ---------------------------------------------------------------------
// #header-bar is fixed to the viewport top and #container is offset below
// it via the --header-height CSS variable (see index.html), so the 3D
// scene can never render behind the header regardless of camera angle.
// The header's real rendered height can change (sign-in text, filter
// dropdowns populating, wrapping on resize), so it's re-measured whenever
// its box size actually changes rather than assumed to be constant.

const headerBar = document.getElementById( 'header-bar' );
const sceneContainer = document.getElementById( 'container' );

function syncHeaderHeight() {

    const height = Math.ceil( headerBar.getBoundingClientRect().height );
    document.documentElement.style.setProperty( '--header-height', height + 'px' );

}

syncHeaderHeight();

new ResizeObserver( () => {

    syncHeaderHeight();
    if ( camera && renderer ) onWindowResize();

} ).observe( headerBar );

// ---------------------------------------------------------------------
// Google Sign-In
// ---------------------------------------------------------------------

function waitForGoogleIdentity( callback ) {

    if ( window.google && window.google.accounts && window.google.accounts.id ) {

        callback();

    } else {

        setTimeout( () => waitForGoogleIdentity( callback ), 50 );

    }

}

function decodeJwt( token ) {

    const payload = token.split( '.' )[ 1 ];
    const json = atob( payload.replace( /-/g, '+' ).replace( /_/g, '/' ) );
    return JSON.parse( json );

}

function handleCredentialResponse( response ) {

    let profile;

    try {

        profile = decodeJwt( response.credential );

    } catch ( err ) {

        document.getElementById( 'login-status' ).textContent = 'Could not read sign-in response. Please try again.';
        return;

    }

    document.getElementById( 'login-screen' ).style.display = 'none';
    document.getElementById( 'info' ).textContent = `Signed in as ${ profile.name } — drag to rotate, scroll to zoom.`;

    loadDataAndStart();

}

function initGoogleSignIn() {

    google.accounts.id.initialize( {
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse
    } );

    google.accounts.id.renderButton(
        document.getElementById( 'google-btn-slot' ),
        { theme: 'filled_black', size: 'large', shape: 'pill' }
    );

}

waitForGoogleIdentity( initGoogleSignIn );

// ---------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------

function parseNetWorth( raw ) {

    if ( ! raw ) return 0;
    const cleaned = String( raw ).replace( /[^0-9.]/g, '' );
    return parseFloat( cleaned ) || 0;

}

const CSV_FETCH_MAX_ATTEMPTS = 3;
const CSV_FETCH_RETRY_DELAYS_MS = [ 1000, 2000, 4000 ];

function delay( ms ) {

    return new Promise( resolve => setTimeout( resolve, ms ) );

}

function fetchCsvWithRetry( attempt = 1 ) {

    return fetch( SHEET_CSV_URL )
        .then( res => {

            if ( ! res.ok ) throw new Error( 'Network response was not ok (' + res.status + ')' );
            return res.text();

        } )
        .catch( err => {

            if ( attempt >= CSV_FETCH_MAX_ATTEMPTS ) throw err;

            document.getElementById( 'loading-screen' ).textContent = 'Reconnecting…';

            return delay( CSV_FETCH_RETRY_DELAYS_MS[ attempt - 1 ] )
                .then( () => fetchCsvWithRetry( attempt + 1 ) );

        } );

}

function loadDataAndStart() {

    document.getElementById( 'loading-screen' ).style.display = 'flex';

    fetchCsvWithRetry()
        .then( csvText => {

            const parsed = Papa.parse( csvText, {
                header: true,
                skipEmptyLines: true,
                transformHeader: h => h.trim()
            } );

            people = parsed.data.map( row => ( {
                name: row.Name || 'Unknown',
                photo: row.Photo || '',
                age: row.Age || '',
                country: row.Country || '',
                interest: row.Interest || '',
                netWorth: parseNetWorth( row[ 'Net Worth' ] )
            } ) );

            populateFilterDropdowns();

            document.getElementById( 'loading-screen' ).style.display = 'none';
            init( people );
            animate();

        } )
        .catch( err => {

            document.getElementById( 'loading-screen' ).innerHTML =
                'Could not load data from the Google Sheet.<br>' + err.message;

        } );

}

// ---------------------------------------------------------------------
// Colour coding by net worth
// ---------------------------------------------------------------------
// Single source of truth for the red/orange/green bucketing — used both
// for tile fill/border color and for the net-worth filter dropdown, so
// the two can never drift apart.

function netWorthBracket( netWorth ) {

    if ( netWorth < 100000 ) return 'red';
    if ( netWorth <= 200000 ) return 'orange';
    return 'green';

}

const NET_WORTH_COLORS = {
    red: { bg: 'rgba(226,75,74,0.18)', border: 'rgba(226,75,74,0.8)' },
    orange: { bg: 'rgba(239,159,39,0.18)', border: 'rgba(239,159,39,0.8)' },
    green: { bg: 'rgba(99,196,106,0.18)', border: 'rgba(99,196,106,0.8)' }
};

function colorForNetWorth( netWorth ) {

    return NET_WORTH_COLORS[ netWorthBracket( netWorth ) ];

}

// ---------------------------------------------------------------------
// Person detail panel
// ---------------------------------------------------------------------

const detailPanel = document.getElementById( 'detail-panel' );
const detailName = document.getElementById( 'detail-name' );
const detailAgeCountry = document.getElementById( 'detail-age-country' );
const detailInterest = document.getElementById( 'detail-interest' );
const detailWorth = document.getElementById( 'detail-worth' );
const detailClose = document.getElementById( 'detail-panel-close' );

detailClose.addEventListener( 'click', () => {

    detailPanel.classList.remove( 'visible' );
    returnToPreFocus();

} );

function formatNetWorth( netWorth ) {

    return '$' + netWorth.toLocaleString( 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 } );

}

function showDetailPanel( person ) {

    detailName.textContent = person.name;
    detailAgeCountry.textContent = `${ person.age } · ${ person.country }`;
    detailInterest.textContent = person.interest;
    detailWorth.textContent = formatNetWorth( person.netWorth );
    detailPanel.classList.add( 'visible' );

}

// ---------------------------------------------------------------------
// Search / filter
// ---------------------------------------------------------------------
// Dims/highlights tiles in place via each CSS3DObject's `.element` DOM
// node — never touches position or array order, so it's safe under any
// active layout.

const searchName = document.getElementById( 'search-name' );
const filterCountry = document.getElementById( 'filter-country' );
const filterInterest = document.getElementById( 'filter-interest' );
const filterWorth = document.getElementById( 'filter-worth' );
const clearFiltersBtn = document.getElementById( 'clear-filters' );

let searchDebounceTimer = null;

// Country/interest options come from whatever is actually in the loaded
// sheet — never hardcoded — so the dropdowns can't list a value with no
// matching tile.
function populateFilterDropdowns() {

    const countries = [ ...new Set( people.map( p => p.country ).filter( Boolean ) ) ].sort();
    const interests = [ ...new Set( people.map( p => p.interest ).filter( Boolean ) ) ].sort();

    for ( const country of countries ) {

        const option = document.createElement( 'option' );
        option.value = country;
        option.textContent = country;
        filterCountry.appendChild( option );

    }

    for ( const interest of interests ) {

        const option = document.createElement( 'option' );
        option.value = interest;
        option.textContent = interest;
        filterInterest.appendChild( option );

    }

}

function applyFilters() {

    const nameQuery = searchName.value.trim().toLowerCase();
    const countryValue = filterCountry.value;
    const interestValue = filterInterest.value;
    const worthValue = filterWorth.value;

    const anyFilterActive = nameQuery !== '' || countryValue !== '' || interestValue !== '' || worthValue !== '';

    for ( let i = 0; i < objects.length; i ++ ) {

        const person = people[ i ];
        const element = objects[ i ].element;

        const matchesName = nameQuery === '' || ( person.name && person.name.toLowerCase().includes( nameQuery ) );
        const matchesCountry = countryValue === '' || person.country === countryValue;
        const matchesInterest = interestValue === '' || person.interest === interestValue;
        const matchesWorth = worthValue === '' || netWorthBracket( person.netWorth ) === worthValue;

        const isMatch = matchesName && matchesCountry && matchesInterest && matchesWorth;

        if ( isMatch ) {

            element.style.opacity = '1';
            element.classList.toggle( 'match', anyFilterActive );

        } else {

            element.style.opacity = '0.12';
            element.classList.remove( 'match' );

        }

    }

}

function scheduleApplyFilters() {

    if ( searchDebounceTimer ) clearTimeout( searchDebounceTimer );
    searchDebounceTimer = setTimeout( applyFilters, 150 );

}

searchName.addEventListener( 'input', scheduleApplyFilters );
filterCountry.addEventListener( 'change', applyFilters );
filterInterest.addEventListener( 'change', applyFilters );
filterWorth.addEventListener( 'change', applyFilters );

clearFiltersBtn.addEventListener( 'click', () => {

    searchName.value = '';
    filterCountry.value = '';
    filterInterest.value = '';
    filterWorth.value = '';
    applyFilters();

} );

// ---------------------------------------------------------------------
// Three.js scene
// ---------------------------------------------------------------------

let camera, scene, renderer, controls;
const objects = [];
let people = [];
const targets = { table: [], sphere: [], helix: [], grid: [], pyramid: [] };

const FOCUS_DISTANCE = 700;
const FOCUS_DURATION = 1000;
const DRAG_THRESHOLD = 5; // px — pointerdown/pointerup further apart than this counts as a drag, not a click

let focusTargetTween, focusCameraTween, focusRenderTween, focusUpTween;
let preFocusState = null; // camera position + controls.target from before the first focus, or null when nothing is focused

function focusOnObject( objectCSS ) {

    if ( preFocusState === null ) {

        preFocusState = {
            position: camera.position.clone(),
            target: controls.target.clone()
        };

    }

    if ( focusTargetTween ) focusTargetTween.stop();
    if ( focusCameraTween ) focusCameraTween.stop();
    if ( focusRenderTween ) focusRenderTween.stop();

    const targetPos = objectCSS.position.clone();

    const direction = new THREE.Vector3().subVectors( camera.position, controls.target );
    if ( direction.lengthSq() < 1e-6 ) direction.set( 0, 0, 1 );
    direction.normalize();

    const newCameraPos = targetPos.clone().addScaledVector( direction, FOCUS_DISTANCE );

    focusTargetTween = new TWEEN.Tween( controls.target )
        .to( { x: targetPos.x, y: targetPos.y, z: targetPos.z }, FOCUS_DURATION )
        .easing( TWEEN.Easing.Exponential.InOut )
        .start();

    focusCameraTween = new TWEEN.Tween( camera.position )
        .to( { x: newCameraPos.x, y: newCameraPos.y, z: newCameraPos.z }, FOCUS_DURATION )
        .easing( TWEEN.Easing.Exponential.InOut )
        .start();

    focusRenderTween = new TWEEN.Tween( {} )
        .to( {}, FOCUS_DURATION )
        .onUpdate( render )
        .start();

}

function returnToPreFocus() {

    if ( preFocusState === null ) return;

    const { position, target } = preFocusState;
    preFocusState = null;

    if ( focusTargetTween ) focusTargetTween.stop();
    if ( focusCameraTween ) focusCameraTween.stop();
    if ( focusRenderTween ) focusRenderTween.stop();

    focusTargetTween = new TWEEN.Tween( controls.target )
        .to( { x: target.x, y: target.y, z: target.z }, FOCUS_DURATION )
        .easing( TWEEN.Easing.Exponential.InOut )
        .start();

    focusCameraTween = new TWEEN.Tween( camera.position )
        .to( { x: position.x, y: position.y, z: position.z }, FOCUS_DURATION )
        .easing( TWEEN.Easing.Exponential.InOut )
        .start();

    focusRenderTween = new TWEEN.Tween( {} )
        .to( {}, FOCUS_DURATION )
        .onUpdate( render )
        .start();

}

// --- click-to-focus: TrackballControls calls setPointerCapture() on its
// domElement on every pointerdown, which retargets the matching pointerup
// away from the tile div (a descendant) to domElement itself. A 'pointerup'
// listener on the tile would therefore never fire. Listening on window
// instead still sees the event, since capture only substitutes the hit-test
// target — the event still bubbles from there up through window. ---

let clickCandidate = null;

window.addEventListener( 'pointerup', ( event ) => {

    if ( ! clickCandidate ) return;

    const dx = event.clientX - clickCandidate.x;
    const dy = event.clientY - clickCandidate.y;
    const candidate = clickCandidate;
    clickCandidate = null;

    if ( Math.hypot( dx, dy ) < DRAG_THRESHOLD ) {

        showDetailPanel( candidate.person );
        focusOnObject( candidate.objectCSS );

    }

} );

function init( people ) {

    camera = new THREE.PerspectiveCamera( 40, sceneContainer.clientWidth / sceneContainer.clientHeight, 1, 10000 );

    const DEFAULT_CAMERA_POSITION = new THREE.Vector3( 0, 0, 3000 );
    const DEFAULT_CAMERA_TARGET = new THREE.Vector3( 0, 0, 0 );
    const DEFAULT_CAMERA_UP = new THREE.Vector3( 0, 1, 0 );

    camera.position.copy( DEFAULT_CAMERA_POSITION );

    scene = new THREE.Scene();

    const COLS = 20, ROWS = 10; // table: 20 x 10 = 200
    const GX = 5, GY = 4, GZ = 10; // grid: 5 x 4 x 10 = 200

    for ( let i = 0; i < people.length; i ++ ) {

        const person = people[ i ];
        const colors = colorForNetWorth( person.netWorth );

        const element = document.createElement( 'div' );
        element.className = 'element';
        element.style.backgroundColor = colors.bg;
        element.style.borderColor = colors.border;
        element.title = person.name;

        const worth = document.createElement( 'div' );
        worth.className = 'worth';
        worth.textContent = '$' + Math.round( person.netWorth / 1000 ) + 'K';
        element.appendChild( worth );

        const photo = document.createElement( 'div' );
        photo.className = 'photo';
        if ( person.photo ) {

            const img = document.createElement( 'img' );
            img.src = person.photo;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.onerror = () => { photo.style.background = colors.border; img.remove(); };
            photo.appendChild( img );

        }
        element.appendChild( photo );

        const name = document.createElement( 'div' );
        name.className = 'name';
        name.textContent = person.name;
        element.appendChild( name );

        const details = document.createElement( 'div' );
        details.className = 'details';
        details.innerHTML = `${ person.age } · ${ person.country }<br>${ person.interest }`;
        element.appendChild( details );

        const objectCSS = new CSS3DObject( element );
        scene.add( objectCSS );

        objects.push( objectCSS );

        // --- click-to-focus: register this tile as the click candidate on
        // pointerdown; the shared window-level 'pointerup' listener above
        // decides whether it was a click or a drag. ---

        element.addEventListener( 'pointerdown', ( event ) => {

            clickCandidate = { x: event.clientX, y: event.clientY, person, objectCSS };

        } );

        // --- table target: sequential fill, 20 columns x 10 rows ---

        const col = i % COLS;
        const row = Math.floor( i / COLS );

        const tableObj = new THREE.Object3D();
        tableObj.position.x = ( col * 150 ) - ( ( COLS - 1 ) * 150 ) / 2;
        tableObj.position.y = - ( row * 190 ) + ( ( ROWS - 1 ) * 190 ) / 2;
        targets.table.push( tableObj );

        // --- first load: place directly at the table position instead of
        // scattering + tweening in. That "fly in from scatter" reveal is
        // reserved for later, deliberate SPHERE/HELIX/GRID/TABLE clicks via
        // transform(), where a moment of animation is expected. Doing it on
        // first paint just adds 400 concurrent tweens + several seconds of
        // full-scene CSS3D re-render at the moment the page is least able
        // to afford it. ---

        objectCSS.position.copy( tableObj.position );
        objectCSS.rotation.copy( tableObj.rotation );

        // --- grid target: 5 x 4 x 10 ---

        const gcol = i % GX;
        const grow = Math.floor( i / GX ) % GY;
        const glayer = Math.floor( i / ( GX * GY ) );

        const gridObj = new THREE.Object3D();
        gridObj.position.x = ( gcol * 400 ) - ( ( GX - 1 ) * 400 ) / 2;
        gridObj.position.y = - ( grow * 400 ) + ( ( GY - 1 ) * 400 ) / 2;
        gridObj.position.z = ( glayer * 500 ) - ( ( GZ - 1 ) * 500 ) / 2;
        targets.grid.push( gridObj );

    }

    // --- sphere target: generic, works for any object count ---

    const vector = new THREE.Vector3();

    for ( let i = 0, l = objects.length; i < l; i ++ ) {

        const phi = Math.acos( - 1 + ( 2 * i ) / l );
        const theta = Math.sqrt( l * Math.PI ) * phi;

        const object = new THREE.Object3D();
        object.position.setFromSphericalCoords( 800, phi, theta );

        vector.copy( object.position ).multiplyScalar( 2 );
        object.lookAt( vector );

        targets.sphere.push( object );

    }

    // --- double helix target: two strands, offset 180 degrees ---
    // even indices -> strand A, odd indices -> strand B, so adjacent
    // data rows sit across from each other like DNA base pairs.

    const strandCount = Math.ceil( objects.length / 2 );

    for ( let i = 0, l = objects.length; i < l; i ++ ) {

        const strand = i % 2;
        const idx = Math.floor( i / 2 );

        const theta = idx * 0.34 + Math.PI + ( strand * Math.PI );
        const y = - ( idx * 9 ) + ( strandCount * 9 ) / 2;

        const object = new THREE.Object3D();
        object.position.setFromCylindricalCoords( 900, theta, y );

        vector.x = object.position.x * 2;
        vector.y = object.position.y;
        vector.z = object.position.z * 2;
        object.lookAt( vector );

        targets.helix.push( object );

    }

    // --- tetrahedron (pyramid) target: 4 regular-tetrahedron vertices,
    // centered at the origin with roughly the same bounding radius as the
    // sphere layout (800). Tiles split evenly across the 4 triangular
    // faces (50 each via simple index blocks), then spread within each
    // face using a plain triangular row/column grid (row r has r+1 points,
    // running from the apex vA down to the base edge vB-vC), normalized to
    // barycentric coordinates that sum to 1. 50 isn't a perfect triangular
    // number (T(9)=45, T(10)=55), so the grid runs 10 rows and simply stops
    // once 50 points are placed, leaving the base row partially filled —
    // a small, acceptable amount of unevenness rather than a real defect.
    //
    // Both t and s are offset by half a grid step so they never reach
    // exactly 0 or 1. Without that offset, every row's first/last column
    // sat exactly on the vA-vB / vA-vC / vB-vC edges — and since a
    // tetrahedron's 6 edges are each shared by 2 faces declared with the
    // same ascending vertex order (e.g. both face0=[0,1,2] and
    // face1=[0,1,3] treat v0-v1 as their vA-vB edge), both faces sampled
    // those shared edges identically and landed on the exact same 3D
    // points — 80 of the 200 tiles were duplicated on top of another
    // tile this way. The half-step keeps every tile strictly inside its
    // own face, so no two faces can ever land on the same point.
    //
    // Rotation uses the face's own constant flat-plane normal rather than
    // each tile's individual radial direction from the tetrahedron center
    // (the sphere/helix convention). A flat face has exactly one correct
    // outward direction; the radial direction only approximates it near a
    // face's centroid and diverges sharply near the corners (measured up
    // to ~70 degrees off), which is what made corner tiles appear to jut
    // out at extreme angles instead of lying flush with their face.
    //
    // Every tetrahedron vertex is shared by 3 of the 4 faces, so even with
    // the half-step offset above (which stops faces from landing on the
    // exact same point), each face's own corner tiles still sample close
    // to that shared vertex — putting 3 faces' worth of corner tiles, each
    // tilted at its own face's ~70 degree dihedral angle, tightly bunched
    // together. Viewed edge-on from some camera angles this reads as a
    // stray "streak" jutting off the main shape, even though every tile's
    // position is individually correct and bounded. INSET shrinks each
    // face's barycentric weights toward its centroid (1/3, 1/3, 1/3)
    // before mapping to 3D, pulling every tile back from the vertices and
    // edges so faces keep clear breathing room from each other. ---

    const INSET = 0.88;

    const TETRA_RADIUS = 800;
    const TETRA_SCALE = TETRA_RADIUS / Math.sqrt( 3 );

    const tetraVertices = [
        new THREE.Vector3( 1, 1, 1 ).multiplyScalar( TETRA_SCALE ),
        new THREE.Vector3( 1, -1, -1 ).multiplyScalar( TETRA_SCALE ),
        new THREE.Vector3( -1, 1, -1 ).multiplyScalar( TETRA_SCALE ),
        new THREE.Vector3( -1, -1, 1 ).multiplyScalar( TETRA_SCALE )
    ];

    const tetraFaces = [
        [ 0, 1, 2 ],
        [ 0, 1, 3 ],
        [ 0, 2, 3 ],
        [ 1, 2, 3 ]
    ];

    const TILES_PER_FACE = 50;
    const GRID_ROWS = 10; // T(10) = 55 >= 50, the smallest row count that fits every tile

    for ( let i = 0, l = objects.length; i < l; i ++ ) {

        const face = Math.floor( i / TILES_PER_FACE );
        const local = i % TILES_PER_FACE;

        const [ ia, ib, ic ] = tetraFaces[ face ];
        const vA = tetraVertices[ ia ], vB = tetraVertices[ ib ], vC = tetraVertices[ ic ];

        // find this tile's (row, col) in the triangular grid: row r holds
        // r+1 points, so row starts fall at the triangular numbers 0,1,3,6,...
        let row = 0, rowStart = 0;
        while ( rowStart + ( row + 1 ) <= local ) {

            rowStart += row + 1;
            row ++;

        }
        const col = local - rowStart;

        const t = ( row + 0.5 ) / GRID_ROWS; // 0..1, apex to base, never exactly 0 or 1
        const s = ( col + 0.5 ) / ( row + 1 ); // 0..1 across the row, never exactly 0 or 1

        const rawBaryA = 1 - t;
        const rawBaryB = t * ( 1 - s );
        const rawBaryC = t * s;

        // shrink toward the face centroid (1/3, 1/3, 1/3) so tiles never
        // sample all the way out to a vertex or edge
        const baryA = 1 / 3 + INSET * ( rawBaryA - 1 / 3 );
        const baryB = 1 / 3 + INSET * ( rawBaryB - 1 / 3 );
        const baryC = 1 / 3 + INSET * ( rawBaryC - 1 / 3 );

        const object = new THREE.Object3D();
        object.position.set(
            baryA * vA.x + baryB * vB.x + baryC * vC.x,
            baryA * vA.y + baryB * vB.y + baryC * vC.y,
            baryA * vA.z + baryB * vB.z + baryC * vC.z
        );

        const faceNormal = new THREE.Vector3()
            .subVectors( vB, vA )
            .cross( new THREE.Vector3().subVectors( vC, vA ) )
            .normalize();

        if ( faceNormal.dot( object.position ) < 0 ) faceNormal.negate();

        vector.copy( object.position ).add( faceNormal );
        object.lookAt( vector );

        targets.pyramid.push( object );

    }

    // --- renderer / controls ---

    renderer = new CSS3DRenderer();
    renderer.setSize( sceneContainer.clientWidth, sceneContainer.clientHeight );
    sceneContainer.appendChild( renderer.domElement );

    controls = new TrackballControls( camera, renderer.domElement );
    controls.minDistance = 500;
    controls.maxDistance = 6000;
    controls.addEventListener( 'change', render );

    function resetCameraToDefault( duration ) {

        if ( focusTargetTween ) focusTargetTween.stop();
        if ( focusCameraTween ) focusCameraTween.stop();
        if ( focusRenderTween ) focusRenderTween.stop();
        if ( focusUpTween ) focusUpTween.stop();

        focusTargetTween = new TWEEN.Tween( controls.target )
            .to( { x: DEFAULT_CAMERA_TARGET.x, y: DEFAULT_CAMERA_TARGET.y, z: DEFAULT_CAMERA_TARGET.z }, duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();

        focusCameraTween = new TWEEN.Tween( camera.position )
            .to( { x: DEFAULT_CAMERA_POSITION.x, y: DEFAULT_CAMERA_POSITION.y, z: DEFAULT_CAMERA_POSITION.z }, duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();

        // TrackballControls' arcball dragging rotates camera.up along with
        // position/target (unlike OrbitControls, which keeps up fixed), so
        // a drag with roll leaves camera.up non-default — reset it too.
        focusUpTween = new TWEEN.Tween( camera.up )
            .to( { x: DEFAULT_CAMERA_UP.x, y: DEFAULT_CAMERA_UP.y, z: DEFAULT_CAMERA_UP.z }, duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();

        focusRenderTween = new TWEEN.Tween( {} )
            .to( {}, duration )
            .onUpdate( render )
            .start();

    }

    // layout buttons change the whole view, so the "return to pre-focus"
    // notion no longer applies — close the panel and clear the state
    // directly instead of animating back to it.
    function onLayoutButtonClick( targetArr ) {

        if ( preFocusState !== null ) {

            detailPanel.classList.remove( 'visible' );
            preFocusState = null;

        }

        transform( targetArr, 2000 );
        resetCameraToDefault( 2000 );

    }

    document.getElementById( 'table' ).addEventListener( 'click', () => onLayoutButtonClick( targets.table ) );
    document.getElementById( 'sphere' ).addEventListener( 'click', () => onLayoutButtonClick( targets.sphere ) );
    document.getElementById( 'helix' ).addEventListener( 'click', () => onLayoutButtonClick( targets.helix ) );
    document.getElementById( 'grid' ).addEventListener( 'click', () => onLayoutButtonClick( targets.grid ) );
    document.getElementById( 'pyramid' ).addEventListener( 'click', () => onLayoutButtonClick( targets.pyramid ) );

    // tiles are already at their table positions (set above), so just
    // draw the initial frame instead of animating in — see comment at
    // objectCSS.position.copy( tableObj.position ) above.
    render();

    window.addEventListener( 'resize', onWindowResize );

}

function transform( targetArr, duration ) {

    TWEEN.removeAll();

    for ( let i = 0; i < objects.length; i ++ ) {

        const object = objects[ i ];
        const target = targetArr[ i ];

        new TWEEN.Tween( object.position )
            .to( { x: target.position.x, y: target.position.y, z: target.position.z }, Math.random() * duration + duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();

        new TWEEN.Tween( object.rotation )
            .to( { x: target.rotation.x, y: target.rotation.y, z: target.rotation.z }, Math.random() * duration + duration )
            .easing( TWEEN.Easing.Exponential.InOut )
            .start();

    }

    new TWEEN.Tween( {} )
        .to( {}, duration * 2 )
        .onUpdate( render )
        .start();

}

function onWindowResize() {

    camera.aspect = sceneContainer.clientWidth / sceneContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize( sceneContainer.clientWidth, sceneContainer.clientHeight );
    render();

}

function animate() {

    requestAnimationFrame( animate );
    TWEEN.update();
    controls.update();

}

function render() {

    renderer.render( scene, camera );

}
