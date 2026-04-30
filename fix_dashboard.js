const fs = require('fs');
const file = 'admin_portal/src/app/[locale]/admin/dashboard/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const oldStr = `  </div>
  </div>
  )}
  </div>
  );
}`;

const newStr = `  </>
  )}
  </div>
  </div>
  )}
  </div>
  );
}`;

content = content.replace(oldStr, newStr);
fs.writeFileSync(file, content);
