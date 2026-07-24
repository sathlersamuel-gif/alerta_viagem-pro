// Aeroportos internacionais disponíveis no buscador
(() => {
  if (typeof airports === 'undefined' || !Array.isArray(airports)) return;
  const international = [
    ['EZE','Buenos Aires','Argentina','Aeroporto Internacional de Ezeiza'],
    ['AEP','Buenos Aires','Argentina','Aeroparque Jorge Newbery'],
    ['SCL','Santiago','Chile','Aeroporto Internacional Arturo Merino Benítez'],
    ['LIM','Lima','Peru','Aeroporto Internacional Jorge Chávez'],
    ['BOG','Bogotá','Colômbia','Aeroporto Internacional El Dorado'],
    ['MVD','Montevidéu','Uruguai','Aeroporto Internacional de Carrasco'],
    ['ASU','Assunção','Paraguai','Aeroporto Internacional Silvio Pettirossi'],
    ['MIA','Miami','Estados Unidos','Aeroporto Internacional de Miami'],
    ['MCO','Orlando','Estados Unidos','Aeroporto Internacional de Orlando'],
    ['JFK','Nova York','Estados Unidos','Aeroporto Internacional John F. Kennedy'],
    ['EWR','Nova York','Estados Unidos','Aeroporto Internacional de Newark'],
    ['LAX','Los Angeles','Estados Unidos','Aeroporto Internacional de Los Angeles'],
    ['LAS','Las Vegas','Estados Unidos','Aeroporto Internacional Harry Reid'],
    ['YYZ','Toronto','Canadá','Aeroporto Internacional Toronto Pearson'],
    ['YUL','Montreal','Canadá','Aeroporto Internacional Montréal-Trudeau'],
    ['CUN','Cancún','México','Aeroporto Internacional de Cancún'],
    ['MEX','Cidade do México','México','Aeroporto Internacional Benito Juárez'],
    ['LIS','Lisboa','Portugal','Aeroporto Humberto Delgado'],
    ['OPO','Porto','Portugal','Aeroporto Francisco Sá Carneiro'],
    ['MAD','Madri','Espanha','Aeroporto Adolfo Suárez Madrid-Barajas'],
    ['BCN','Barcelona','Espanha','Aeroporto Josep Tarradellas Barcelona-El Prat'],
    ['CDG','Paris','França','Aeroporto Charles de Gaulle'],
    ['ORY','Paris','França','Aeroporto de Paris-Orly'],
    ['LHR','Londres','Reino Unido','Aeroporto de Heathrow'],
    ['LGW','Londres','Reino Unido','Aeroporto de Gatwick'],
    ['FCO','Roma','Itália','Aeroporto Leonardo da Vinci-Fiumicino'],
    ['MXP','Milão','Itália','Aeroporto de Milão-Malpensa'],
    ['AMS','Amsterdã','Países Baixos','Aeroporto de Schiphol'],
    ['FRA','Frankfurt','Alemanha','Aeroporto de Frankfurt'],
    ['ZRH','Zurique','Suíça','Aeroporto de Zurique'],
    ['DXB','Dubai','Emirados Árabes Unidos','Aeroporto Internacional de Dubai'],
    ['DOH','Doha','Catar','Aeroporto Internacional Hamad'],
    ['IST','Istambul','Turquia','Aeroporto de Istambul'],
    ['NRT','Tóquio','Japão','Aeroporto Internacional de Narita'],
    ['HND','Tóquio','Japão','Aeroporto de Haneda'],
    ['SYD','Sydney','Austrália','Aeroporto Internacional de Sydney']
  ];
  const existing = new Set(airports.map(item => item[0]));
  international.forEach(item => { if (!existing.has(item[0])) airports.push(item); });
})();