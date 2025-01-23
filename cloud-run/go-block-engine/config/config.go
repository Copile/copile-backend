package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	SolanaRPC     string `mapstructure:"solana_rpc"`
	JitoRPC       string `mapstructure:"jito_rpc"`
	JitoAuth      string `mapstructure:"jito_auth"`
	NextBlockURL  string `mapstructure:"nextblock_url"`
	NextBlockAuth string `mapstructure:"nextblock_auth"`
	ProjectID     string `mapstructure:"project_id"`
	Region        string `mapstructure:"region"`
	Port          int    `mapstructure:"port"`
	LogLevel      string `mapstructure:"log_level"`
}

func LoadConfig() (*Config, error) {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AddConfigPath("./config")

	viper.AutomaticEnv()

	// Default values
	viper.SetDefault("solana_rpc", "https://api.mainnet-beta.solana.com")
	viper.SetDefault("jito_rpc", "https://jito-api.mainnet-beta.solana.com")
	viper.SetDefault("nextblock_url", "https://nextblock.solana.com")
	viper.SetDefault("port", 8080)
	viper.SetDefault("log_level", "info")
	viper.SetDefault("region", "europe-west2")

	if err := viper.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, err
		}
	}

	var config Config
	if err := viper.Unmarshal(&config); err != nil {
		return nil, err
	}

	return &config, nil
}
