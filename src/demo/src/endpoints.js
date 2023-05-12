const fs = require("fs");
const stations = require("./stations.json");

for (const station of stations) {
  for (const endpoints of station.endpoints) {
    const matches = endpoints.endpoint.match(/.*?ice2.somafm.com\/(.*)/);

    if (matches) {
      endpoints.endpoint = [];
      for (let i = 1; i <= 6; i++) {
        endpoints.endpoint.push(`https://ice${i}.somafm.com/${matches[1]}`);
      }
      console.log(endpoints.endpoint);
    }
  }
}

fs.writeFileSync("./stations.json", JSON.stringify(stations));
