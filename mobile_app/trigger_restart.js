const fs = require('fs');
// Let's touch main.dart to trigger a hot reload, but hot restart is better for state
fs.utimesSync('lib/main.dart', new Date(), new Date());
