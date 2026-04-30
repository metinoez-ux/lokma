const fs = require('fs');
const file = 'admin_portal/src/app/[locale]/admin/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = / <\/div>\n <\/div>\n <\/div>\n <\/div>\n \)}\n <\/div>\n \);\n\}/;
const newStr = ` </div>
 </div>
 </>
 )}
 </div>
 </div>
 )}
 </div>
 );
}`;

if (regex.test(content)) {
    content = content.replace(regex, newStr);
    fs.writeFileSync(file, content);
    console.log("Replaced successfully!");
} else {
    console.log("Not found.");
}
