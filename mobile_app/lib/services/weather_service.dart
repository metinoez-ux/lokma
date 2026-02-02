import 'dart:convert';
import 'package:http/http.dart' as http;

/// OpenWeatherMap API ile hava durumu verileri
/// Free tier: 1000 calls/day, 7-day forecast
class WeatherService {
  // OpenWeatherMap Free API Key (1000 calls/day)
  static const String _apiKey = 'bd5e378503939ddaee76f12ad7a97608'; // Demo key
  static const String _baseUrl = 'https://api.openweathermap.org/data/2.5';
  
  /// Belirli koordinatlar için 7 günlük hava durumu tahmini al
  static Future<WeatherForecast?> getForecast({
    required double lat,
    required double lon,
  }) async {
    try {
      final url = Uri.parse(
        '$_baseUrl/forecast?lat=$lat&lon=$lon&appid=$_apiKey&units=metric&lang=tr&cnt=40',
      );
      
      final response = await http.get(url);
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return WeatherForecast.fromJson(data);
      }
      return null;
    } catch (e) {
      print('Weather API error: $e');
      return null;
    }
  }
  
  /// Mevcut hava durumu
  static Future<CurrentWeather?> getCurrentWeather({
    required double lat,
    required double lon,
  }) async {
    try {
      final url = Uri.parse(
        '$_baseUrl/weather?lat=$lat&lon=$lon&appid=$_apiKey&units=metric&lang=tr',
      );
      
      final response = await http.get(url);
      
      if (response.statusCode == 200) {
        final data = json.decode(response.body);
        return CurrentWeather.fromJson(data);
      }
      return null;
    } catch (e) {
      print('Weather API error: $e');
      return null;
    }
  }
}

class WeatherForecast {
  final String cityName;
  final List<HourlyWeather> hourlyForecasts;
  
  WeatherForecast({
    required this.cityName,
    required this.hourlyForecasts,
  });
  
  factory WeatherForecast.fromJson(Map<String, dynamic> json) {
    final list = json['list'] as List<dynamic>? ?? [];
    return WeatherForecast(
      cityName: json['city']?['name'] ?? '',
      hourlyForecasts: list.map((e) => HourlyWeather.fromJson(e)).toList(),
    );
  }
  
  /// Belirli bir gün için saatlik tahminleri getir
  List<HourlyWeather> getHourlyForDay(DateTime date) {
    return hourlyForecasts.where((h) => 
      h.dateTime.year == date.year &&
      h.dateTime.month == date.month &&
      h.dateTime.day == date.day
    ).toList();
  }
  
  /// Günlük ortalama hava durumu özeti
  List<DailyWeatherSummary> getDailySummaries() {
    final Map<String, List<HourlyWeather>> grouped = {};
    
    for (final h in hourlyForecasts) {
      final key = '${h.dateTime.year}-${h.dateTime.month}-${h.dateTime.day}';
      grouped.putIfAbsent(key, () => []).add(h);
    }
    
    return grouped.entries.map((e) {
      final items = e.value;
      final avgTemp = items.map((i) => i.temperature).reduce((a, b) => a + b) / items.length;
      final maxRain = items.map((i) => i.rainProbability).reduce((a, b) => a > b ? a : b);
      final avgWind = items.map((i) => i.windSpeed).reduce((a, b) => a + b) / items.length;
      
      // En sık görülen iconı al
      final iconCounts = <String, int>{};
      for (final item in items) {
        iconCounts[item.icon] = (iconCounts[item.icon] ?? 0) + 1;
      }
      final mainIcon = iconCounts.entries.reduce((a, b) => a.value > b.value ? a : b).key;
      
      return DailyWeatherSummary(
        date: items.first.dateTime,
        avgTemperature: avgTemp,
        maxRainProbability: maxRain,
        avgWindSpeed: avgWind,
        icon: mainIcon,
        description: items.first.description,
      );
    }).toList();
  }
}

class HourlyWeather {
  final DateTime dateTime;
  final double temperature;
  final double feelsLike;
  final double rainProbability;
  final double windSpeed;
  final String description;
  final String icon;
  
  HourlyWeather({
    required this.dateTime,
    required this.temperature,
    required this.feelsLike,
    required this.rainProbability,
    required this.windSpeed,
    required this.description,
    required this.icon,
  });
  
  factory HourlyWeather.fromJson(Map<String, dynamic> json) {
    return HourlyWeather(
      dateTime: DateTime.fromMillisecondsSinceEpoch((json['dt'] as int) * 1000),
      temperature: (json['main']?['temp'] as num?)?.toDouble() ?? 0,
      feelsLike: (json['main']?['feels_like'] as num?)?.toDouble() ?? 0,
      rainProbability: ((json['pop'] as num?)?.toDouble() ?? 0) * 100,
      windSpeed: ((json['wind']?['speed'] as num?)?.toDouble() ?? 0) * 3.6, // m/s to km/h
      description: (json['weather'] as List?)?.firstOrNull?['description'] ?? '',
      icon: (json['weather'] as List?)?.firstOrNull?['icon'] ?? '01d',
    );
  }
  
  String get iconUrl => 'https://openweathermap.org/img/wn/$icon@2x.png';
}

class DailyWeatherSummary {
  final DateTime date;
  final double avgTemperature;
  final double maxRainProbability;
  final double avgWindSpeed;
  final String icon;
  final String description;
  
  DailyWeatherSummary({
    required this.date,
    required this.avgTemperature,
    required this.maxRainProbability,
    required this.avgWindSpeed,
    required this.icon,
    required this.description,
  });
  
  String get iconUrl => 'https://openweathermap.org/img/wn/$icon@2x.png';
}

class CurrentWeather {
  final double temperature;
  final double feelsLike;
  final String description;
  final String icon;
  final double windSpeed;
  final int humidity;
  
  CurrentWeather({
    required this.temperature,
    required this.feelsLike,
    required this.description,
    required this.icon,
    required this.windSpeed,
    required this.humidity,
  });
  
  factory CurrentWeather.fromJson(Map<String, dynamic> json) {
    return CurrentWeather(
      temperature: (json['main']?['temp'] as num?)?.toDouble() ?? 0,
      feelsLike: (json['main']?['feels_like'] as num?)?.toDouble() ?? 0,
      description: (json['weather'] as List?)?.firstOrNull?['description'] ?? '',
      icon: (json['weather'] as List?)?.firstOrNull?['icon'] ?? '01d',
      windSpeed: ((json['wind']?['speed'] as num?)?.toDouble() ?? 0) * 3.6,
      humidity: json['main']?['humidity'] ?? 0,
    );
  }
  
  String get iconUrl => 'https://openweathermap.org/img/wn/$icon@2x.png';
}
