const width = 800, height = 800;
const container = d3.select("#globe-container");
const tooltip = d3.select("#tooltip");

const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

const projection = d3.geoOrthographic()
    .scale(350)
    .translate([width / 2, height / 2])
    .clipAngle(90);

const path = d3.geoPath().projection(projection);

const globe = svg.append("g");

// Remove the blue globe background (sky blue)
globe.append("circle")
    .attr("cx", width / 2)
    .attr("cy", height / 2)
    .attr("r", projection.scale())
    .attr("fill", "none"); // Just make it transparent

// Initialize variables for COVID data
let covidMap = new Map();
let mostRecentDate = new Date("2024-11-17");
let currentYear = 2020; // Default starting year

// Load GeoJSON and COVID-19 data
Promise.all([
    d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"),
    d3.csv("/data/who_covid_data_with_coordinates.csv")
]).then(([geoData, covidData]) => {
    // Parse COVID-19 data and filter based on the current year
    const filterDataByYear = (year) => {
        return covidData.filter(d => new Date(d.Date_reported).getFullYear() === year);
    };

    // Initial dataset based on default year
    let filteredData = filterDataByYear(currentYear);

    // Standardize country names to match GeoJSON data
    filteredData.forEach(d => {
        if (d.Country === "Russian Federation") d.Country = "Russia";
        if (d.Country === "United States of America") d.Country = "USA";
        if (d.Country === "Iran (Islamic Republic of)") d.Country = "Iran";
        if (d.Country === "Venezuela (Bolivarian Republic of)") d.Country = "Venezuela";
        if (d.Country === "Congo") d.Country = "Republic of the Congo";
        if (d.Country === "Syrian Arab Republic") d.Country = "Syria";
        if (d.Country === "United Kingdom of Great Britain and Northern Ireland") d.Country = "England";
        if (d.Country === "Bolivia (Plurinational State of)") d.Country = "Bolivia";
        if (d.Country === "Czechia") d.Country = "Czech Republic";
        if (d.Country === "Serbia") d.Country = "Republic of Serbia";
        if (d.Country === "Viet Nam") d.Country = "Vietnam";
        if (d.Country === "Republic of Korea") d.Country = "South Korea";
        if (d.Country === "Democratic People's Republic of Korea") d.Country = "North Korea";
        if (d.Country === "Republic of Moldova") d.Country = "Moldova";
        if (d.Country === "Lao People's Democratic Republic") d.Country = "Laos";
        if (d.Country === "Türkiye") d.Country = "Turkey";
    });

    covidMap = new Map(filteredData.map(d => [d.Country, {
        cases: +d.Cumulative_cases,
        deaths: +d.Cumulative_deaths,
        vaccines: +d.Cumulative_vaccinations, // Add vaccination data
        whoRegion: d.WHO_region, // Add WHO region information
    }]));

    // Define color scale for cases
    const maxCases = d3.max(filteredData, d => +d.Cumulative_cases);
    const colorScale = d3.scaleSequential(d3.interpolateReds)
        .domain([0, maxCases]);

    // Draw the countries on the globe
    globe.selectAll("path")
        .data(geoData.features)
        .enter().append("path")
        .attr("d", path)
        .attr("fill", d => {
            const country = d.properties.name;
            const data = covidMap.get(country) || { cases: 0, deaths: 0 };
            return colorScale(data.cases);
        })
        .attr("stroke", "#666")
        .attr("stroke-width", 0.5)
        .on("mouseover", (event, d) => {
            const country = d.properties.name;
            const data = covidMap.get(country) || { cases: 'No data', deaths: 'No data', vaccines: 'No data', whoRegion: 'Unknown' };
            tooltip.style("display", "block")
                .style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`)
                .html(`
                    <strong>${country}</strong><br>
                    WHO Region: ${data.whoRegion}<br>
                    Cumulative Cases: ${data.cases}<br>
                    Cumulative Deaths: ${data.deaths}<br>
                    Vaccinations: ${data.vaccines}`);
        })
        .on("mousemove", (event) => {
            tooltip.style("left", `${event.pageX + 10}px`)
                .style("top", `${event.pageY + 10}px`);
        })
        .on("mouseout", () => {
            tooltip.style("display", "none");
        });

    // Handle deaths button click
    document.getElementById('Deaths-button').addEventListener('click', () => {
        showDeathData();
    });

    function showDeathData() {
        // Clear previous dots if any
        globe.selectAll(".death-dot").remove();

        // Draw death dots on the globe
        globe.selectAll(".death-dot")
            .data(geoData.features)
            .enter().append("circle")
            .attr("class", "death-dot")
            .attr("cx", d => projection(d.properties.centroid)[0])
            .attr("cy", d => projection(d.properties.centroid)[1])
            .attr("r", d => {
                const country = d.properties.name;
                const data = covidMap.get(country) || { deaths: 0 };
                return Math.sqrt(data.deaths) / 100; // Adjust size of death dots
            })
            .attr("fill", "red")
            .attr("stroke", "black")
            .attr("stroke-width", 0.5);
    }

    // Handle year slider
    document.getElementById("year-slider").addEventListener("input", function() {
        currentYear = parseInt(this.value);
        updateGlobeForYear(currentYear);
    });

    function updateGlobeForYear(year) {
        // Filter the data for the selected year
        filteredData = filterDataByYear(year);
        covidMap = new Map(filteredData.map(d => [d.Country, {
            cases: +d.Cumulative_cases,
            deaths: +d.Cumulative_deaths,
            vaccines: +d.Cumulative_vaccinations,
            whoRegion: d.WHO_region || "Unknown"
        }]));

        // Re-draw countries and death data (dots) for the new year
        globe.selectAll("path")
            .attr("fill", d => {
                const country = d.properties.name;
                const data = covidMap.get(country) || { cases: 0, deaths: 0 };
                return colorScale(data.cases);
            });

        // Update death data dots
        globe.selectAll(".death-dot").remove(); // Remove existing dots
        showDeathData(); // Recreate dots based on the new year
    }

    // Add drag, rotate, and zoom functionality
    svg.call(d3.drag().on("drag", (event) => {
        const rotate = projection.rotate();
        const k = 150 / projection.scale();
        projection.rotate([rotate[0] + event.dx * k, rotate[1] - event.dy * k]);
        globe.selectAll("path").attr("d", path);
        globe.selectAll(".death-dot").attr("cx", d => projection(d.properties.centroid)[0])
            .attr("cy", d => projection(d.properties.centroid)[1]);
    }));

    svg.call(d3.zoom().on("zoom", (event) => {
        projection.scale(350 * event.transform.k);
        globe.selectAll("path").attr("d", path);
        globe.selectAll(".death-dot").attr("r", d => Math.sqrt(covidMap.get(d.properties.name).deaths) / 100 * event.transform.k);
    }));

    // Add a color legend to the bottom right corner away from the globe
    const legendWidth = 300;
    const legendHeight = 10;
    const legendMargin = { top: 20, right: 20, bottom: 20, left: 20 };

    const legendSvg = svg.append("g")
        .attr("class", "legend")
        .attr("transform", `translate(${width - legendWidth - legendMargin.right - 40}, ${height - legendHeight - legendMargin.bottom - 40})`);

    const gradient = legendSvg.append("defs")
        .append("linearGradient")
        .attr("id", "legendGradient")
        .attr("x1", "0%")
        .attr("y1", "0%")
        .attr("x2", "100%")
        .attr("y2", "0%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorScale(0));

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorScale(maxCases));

    legendSvg.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legendGradient)");

    const legendScale = d3.scaleLinear()
        .domain([0, maxCases])
        .range([0, legendWidth]);

    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)
        .tickFormat(d3.format(".2s"));

    legendSvg.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis);

}).catch(error => console.error("Error loading data:", error));
