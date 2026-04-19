const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};

const obj = { name: "Parndorf" };
obj.self = obj; // circular

console.log(JSON.stringify(obj, getCircularReplacer()));
